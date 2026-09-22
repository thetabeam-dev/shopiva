import { useNavigation, useRoute } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { TextInput } from "react-native-gesture-handler";
import {
    errorCodes,
    isErrorWithCode,
    keepLocalCopy,
    pick,
    types,
} from "@react-native-documents/picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getStoredUser } from "../auth/session";
import { connectChatSocket, emitSocketAck } from "../socket/chatSocket";
import { set_orderInfo } from "../../redux/order";
import { useDispatch } from "react-redux";
import { fetchShopOwner } from "../api";
import FormKeyboardAvoiding from "../components/FormKeyboardAvoiding";
import {
    getCurrentCoordinates,
    requestLocationPermission,
    reverseGeocodeToPlace,
} from "../utils/deviceLocation";
import { set_disputeInfo } from "../../redux/dispute";
import { set_disputeList } from "../../redux/disputes";

const DEFAULT_RETURN_COUNTRY = "Nigeria";

function validateAcceptanceForm(values) {
    const errors = {};

    if (!values.confirmClaim) {
        errors.confirmClaim =
            "Please confirm you agree with the dispute resolution.";
    }

    if (values.willReturnItem == null || values.willReturnItem === "") {
        errors.willReturnItem =
            "Select whether the buyer should return the item(s).";
    }

    if (values.willReturnItem === true) {
        if (values.roleForShipping == null || values.roleForShipping === "") {
            errors.roleForShipping =
                "Select whether the buyer ships the item back or you arrange pickup.";
        }

        if (values.roleForShipping) {
            const street = values.address1.trim();
            const city = values.address3.trim();
            const stateVal = values.addressState.trim();
            const country = values.addressCountry.trim();

            if (!street) {
                errors.address1 = "Street address is required.";
            } else if (street.length < 3) {
                errors.address1 = "Enter a valid street address.";
            }

            if (!city) {
                errors.address3 = "City is required.";
            }

            if (!stateVal) {
                errors.addressState = "State is required.";
            }

            if (!country) {
                errors.addressCountry = "Country is required.";
            }
        }
    }

    return errors;
}

function FieldError({ message }) {
    if (!message) return null;
    return <Text style={styles.fieldErrorText}>{message}</Text>;
}

const CANCEL_ORDER_REASONS = [
    { label: "Changed my mind / Ordered by mistake", value: "changed_mind" },
    { label: "Shipping is taking too long", value: "delayed_shipping" },
    { label: "Vendor asked me to cancel", value: "vendor_requested_cancel" },
    { label: "Found a better price elsewhere", value: "better_price" },
    { label: "Other", value: "other" },
];

export default function DisputeActionScreen() {

    const {
        action,
        data
    } = useRoute().params;
    const [acceptance_value, set_acceptance_value] = useState("");

    function updateAccptance(data) {
        set_acceptance_value(data.value)
    }


    return (
        <>
            {
                action === "acceptance" && <Acceptance acceptance_value={acceptance_value} data={data} updateAccptance={updateAccptance} />
            }
        </>
    );
}

function ReturnAddressField({
    label,
    value,
    onChangeText,
    placeholder,
    error,
    multiline = false,
}) {
    return (
        <View style={styles.addressFieldBlock}>
            <Text style={styles.addressFieldLabel}>{label}</Text>
            <TextInput
                style={[
                    styles.textInput,
                    styles.acceptanceFormInput,
                    multiline && styles.textInputMultiline,
                    error ? styles.textInputError : null,
                ]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#999999"
                autoCapitalize="words"
                multiline={multiline}
            />
            <FieldError message={error} />
        </View>
    );
}

function ConfirmCheckbox({ checked, onToggle, label, rowStyle }) {
    return (
        <Pressable
            onPress={() => onToggle(!checked)}
            style={({ pressed }) => [
                styles.checkboxRow,
                rowStyle,
                pressed && styles.checkboxRowPressed,
            ]}
        >
            <View
                style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}
            >
                {checked ? (
                    <Text style={styles.checkboxMark}>✓</Text>
                ) : null}
            </View>
            <Text style={styles.checkboxLabel}>{label}</Text>
        </Pressable>
    );
}

function Acceptance({ data }) {
    const insets = useSafeAreaInsets();
    const dispatch = useDispatch();

    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(false);

    const [confirmClaim, setConfirmClaim] = useState(false);
    const [willReturnItem, setWillReturnItem] = useState(null);
    const [roleForShipping, setRoleForShipping] = useState(null);
    const [address1, setAddress1] = useState("");
    const [address2, setAddress2] = useState("");
    const [address3, setAddress3] = useState("");
    const [addressState, setAddressState] = useState("");
    const [addressCountry, setAddressCountry] = useState(DEFAULT_RETURN_COUNTRY);
    const [locatingAddress, setLocatingAddress] = useState(false);
    const [showErrors, setShowErrors] = useState(false);

    const navigation = useNavigation();

    const errors = useMemo(
        () =>
            showErrors
                ? validateAcceptanceForm({
                      confirmClaim,
                      willReturnItem,
                      roleForShipping,
                      address1,
                      address3,
                      addressState,
                      addressCountry,
                  })
                : {},
        [
            showErrors,
            confirmClaim,
            willReturnItem,
            roleForShipping,
            address1,
            address3,
            addressState,
            addressCountry,
        ]
    );

    const onUseDeviceLocation = useCallback(async () => {
        setLocatingAddress(true);
        try {
            const granted = await requestLocationPermission();
            if (!granted) {
                Alert.alert(
                    "Location",
                    "Permission was denied. You can enter the address manually."
                );
                return;
            }
            const coords = await getCurrentCoordinates();
            const place = await reverseGeocodeToPlace(
                coords.latitude,
                coords.longitude
            );
            setAddress1(place.street);
            setAddress2(place.town);
            setAddress3(place.city);
            setAddressState(place.state);
            setAddressCountry(place.country || DEFAULT_RETURN_COUNTRY);
        } catch (e) {
            Alert.alert(
                "Location",
                e instanceof Error ? e.message : String(e)
            );
        } finally {
            setLocatingAddress(false);
        }
    }, []);
    useEffect(() => {
        connectChatSocket();
    }, [])


    return (
        <>
            <FormKeyboardAvoiding style={[styles.cnt, styles.processingRoot]}>
                {loading && <Spinner />}
                <ScrollView
              keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[
                        styles.processingScrollContent,
                        styles.acceptanceScrollPaddingBottom,
                        { paddingTop: 15 },
                    ]}
                >
                    <View style={styles.processingCard}>
                        <Text style={styles.processingSectionTitle}>
                            Accept claims
                        </Text>
                        <Text style={styles.processingSectionSubtitle}>
                            Confirm each statement. The customer is notified
                            as soon as you accept his/her claims.
                        </Text>
                        <View style={styles.processingChecklist}>
                            <ConfirmCheckbox
                                checked={confirmClaim}
                                onToggle={setConfirmClaim}
                                label="I agree with the dispute resolution"
                                rowStyle={styles.processingCheckboxRow}
                            />
                            <View style={styles.processingChecklistDivider} />
                        </View>
                        <FieldError message={errors.confirmClaim} />
                    </View>

                    <View style={styles.processingCard}>
                        <View style={[{marginVertical: 10}]}>
                            <Text style={styles.processingFieldLabel}>
                                Should the buyer return the item(s)
                            </Text>
                            <Text style={styles.processingFieldHint}>
                                The buyer will be refunded even if the item is not returned.
                            </Text>
                            <Dropdown
                                style={[
                                    styles.processingDropdown,
                                    errors.willReturnItem
                                        ? styles.processingDropdownError
                                        : null,
                                ]}
                                containerStyle={styles.dropdownContainer}
                                placeholderStyle={styles.placeholderStyle}
                                selectedTextStyle={styles.selectedTextStyle}
                                itemTextStyle={styles.processingDropdownItem}
                                iconStyle={styles.iconStyle}
                                data={[
                                    {label: "Yes, the buyer should return the item(s)", value: true},
                                    {label: "No, the buyer can keep the item(s)", value: false},
                                ]}
                                maxHeight={280}
                                labelField="label"
                                valueField="value"
                                placeholder="Select if item will be returned"
                                value={willReturnItem}
                                onChange={(item) => {
                                    setWillReturnItem(item.value);
                                    if (item.value === false) {
                                        setRoleForShipping(null);
                                    }
                                }}
                            />
                            <FieldError message={errors.willReturnItem} />
                        </View>
                        {willReturnItem && <View style={[{marginVertical: 10}]}>
                            <Text style={styles.processingFieldLabel}>
                                Return pickup or buyer shipping?
                            </Text>
                            <Text style={styles.processingFieldHint}>
                                Do the buyer ship the item(s) OR Will you pick it up yourself
                            </Text>
                            <Dropdown
                                style={[
                                    styles.processingDropdown,
                                    errors.roleForShipping
                                        ? styles.processingDropdownError
                                        : null,
                                ]}
                                containerStyle={styles.dropdownContainer}
                                placeholderStyle={styles.placeholderStyle}
                                selectedTextStyle={styles.selectedTextStyle}
                                itemTextStyle={styles.processingDropdownItem}
                                iconStyle={styles.iconStyle}
                                data={[
                                    { label: "Buyer'll ships item back [Recommended]", value: "buyer_shipping" },
                                    { label: "I'll arrange pickup", value: "vendor_pickup" },
                                ]}
                                maxHeight={280}
                                labelField="label"
                                valueField="value"
                                placeholder="Select an option"
                                value={roleForShipping}
                                onChange={(item) =>
                                    setRoleForShipping(item.value)
                                }
                            />
                            <FieldError message={errors.roleForShipping} />
                        </View>}
                        {roleForShipping && (
                            <View style={{ marginVertical: 10 }}>
                                <Text style={styles.processingFieldLabel}>
                                    Return delivery address
                                </Text>
                                <Text style={styles.processingFieldHint}>
                                    {roleForShipping === "vendor_pickup"
                                        ? "Where should the buyer expect pickup, or where will you collect the item?"
                                        : "Where should the buyer ship the returned item(s)?"}
                                </Text>
                                <Pressable
                                    onPress={() => {
                                        void onUseDeviceLocation();
                                    }}
                                    disabled={locatingAddress}
                                    style={({ pressed }) => [
                                        styles.locationFillBtn,
                                        pressed && styles.locationFillBtnPressed,
                                        locatingAddress && styles.locationFillBtnDisabled,
                                    ]}
                                >
                                    {locatingAddress ? (
                                        <ActivityIndicator color="#0D8A4A" size="small" />
                                    ) : (
                                        <Text style={styles.locationFillBtnText}>
                                            Use my current location
                                        </Text>
                                    )}
                                </Pressable>
                                <ReturnAddressField
                                    label="Street address"
                                    value={address1}
                                    onChangeText={setAddress1}
                                    placeholder="e.g. 12 Admiralty Way"
                                    error={errors.address1}
                                />
                                <ReturnAddressField
                                    label="Town / area"
                                    value={address2}
                                    onChangeText={setAddress2}
                                    placeholder="e.g. Lekki Phase 1"
                                />
                                <ReturnAddressField
                                    label="City"
                                    value={address3}
                                    onChangeText={setAddress3}
                                    placeholder="e.g. Lagos"
                                    error={errors.address3}
                                />
                                <ReturnAddressField
                                    label="State"
                                    value={addressState}
                                    onChangeText={setAddressState}
                                    placeholder="e.g. Lagos"
                                    error={errors.addressState}
                                />
                                <ReturnAddressField
                                    label="Country"
                                    value={addressCountry}
                                    onChangeText={setAddressCountry}
                                    placeholder={DEFAULT_RETURN_COUNTRY}
                                    error={errors.addressCountry}
                                />
                            </View>
                        )}
                    </View>

                    <View style={styles.processingCard}>
                        <Text style={styles.processingFieldLabel}>
                            Notes (optional)
                        </Text>
                        <Text style={styles.processingFieldHint}>
                            Optional message stored on the order.
                        </Text>
                        <TextInput
                            style={[
                                styles.textInput,
                                styles.textInputMultiline,
                                styles.acceptanceFormInput,
                            ]}
                            multiline
                            placeholder="Note something down…"
                            onChangeText={(txt) => setNote(txt)}
                        />
                    </View>

                    <View
                        style={[
                            styles.processingCard,
                            styles.acceptDisclaimerCard,
                        ]}
                    >
                        <Text style={styles.acceptIntroText}>
                            By accepting this order, you confirm that the
                            products are available and will be shipped within
                            the required timeframe.
                        </Text>
                    </View>
                </ScrollView>

                <View
                    style={[
                        styles.actionBar,
                        { paddingBottom: Math.max(insets.bottom, 12) },
                    ]}
                >
                    <Pressable
                        onPress={e => navigation.goBack()}
                        style={({ pressed }) => [
                            styles.btnSecondary,
                            pressed && styles.btnSecondaryPressed,
                        ]}
                    >
                        <Text style={styles.btnSecondaryText}>Cancel</Text>
                    </Pressable>

                    <Pressable
                        onPress={async () => {
                            const validationErrors = validateAcceptanceForm({
                                confirmClaim,
                                willReturnItem,
                                roleForShipping,
                                address1,
                                address3,
                                addressState,
                                addressCountry,
                            });
                            if (Object.keys(validationErrors).length > 0) {
                                setShowErrors(true);
                                return;
                            }
                            setShowErrors(false);
                            setLoading(true);
                            Alert.alert(
                                'Confirm dispute acceptance',
                                'By accepting this claim, you agree to resolve the dispute between you & your customer via RETURN',
                                [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: 'Confirm',
                                        style: 'default',
                                        onPress:  AcceptClaim,
                                    },
                                ],
                            );
                           
                            async function AcceptClaim() {
                                const u = await getStoredUser();
                                const returnAddress = willReturnItem && roleForShipping
                                    ? {
                                        address1: address1.trim(),
                                        address2: address2.trim(),
                                        address3: address3.trim(),
                                        state: addressState.trim(),
                                        country: addressCountry.trim() ||
                                            DEFAULT_RETURN_COUNTRY,
                                    }
                                    : null;
                                const response = await emitSocketAck(
                                    "dispute_acceptance",
                                    {
                                        status: "resolved",
                                        ...data,
                                        response: {
                                            will_return_item: willReturnItem,
                                            return_shipping_role: roleForShipping,
                                            return_address: returnAddress,
                                        },
                                        notes: note,
                                        actor_id: u.id,
                                    }
                                );
                                if (response.success) {
                                    console.log(response);
                                    dispatch(set_disputeInfo(response.dispute.vendor.vdi));
                                    dispatch(set_disputeList(response.dispute.vendor.vdl));

                                    navigation.goBack();
                                }
                            }
                        }}
                        style={({ pressed }) => [
                            styles.btnAccept,
                            pressed && styles.btnAcceptPressed,
                        ]}
                    >
                        <Text style={styles.btnAcceptText}>Accept</Text>
                    </Pressable>
                </View>
            </FormKeyboardAvoiding>
        </>
    )
}

function Spinner() {
  return (
    <>
      <View
        style={{
          height: '100%',
          width: '100%',
          position: 'absolute',
          top: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}
      >
        <ActivityIndicator size="large" color="green" />
      </View>
    </>
  );
}


const styles = StyleSheet.create({
    cnt: {
        flex: 1,
        // backgroundColor: '#FFFFFF',
    },
    processingRoot: {
        backgroundColor: '#F2F3F5',
    },
    processingScrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 32,
    },
    acceptanceScrollPaddingBottom: {
        paddingBottom: 100,
    },
    acceptanceFormInput: {
        borderRadius: 5,
        borderColor: '#DCDCE0',
    },
    acceptDisclaimerCard: {
        backgroundColor: '#F8F9FA',
        borderColor: '#ECECEF',
    },
    processingCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 5,
        padding: 16,
        marginBottom: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#E6E7EB',
    },
    processingSectionTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#111111',
        letterSpacing: -0.3,
        marginBottom: 6,
    },
    processingSectionSubtitle: {
        fontSize: 13,
        fontWeight: '400',
        color: '#5C5C66',
        lineHeight: 19,
        marginBottom: 14,
    },
    processingChecklist: {
        backgroundColor: '#F8F9FA',
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#ECECEF',
        overflow: 'hidden',
    },
    processingChecklistDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#E2E2E6',
        marginLeft: 46,
    },
    processingCheckboxRow: {
        paddingVertical: 12,
        paddingHorizontal: 12,
    },
    processingFieldLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111111',
        marginBottom: 4,
    },
    processingFieldHint: {
        fontSize: 12,
        fontWeight: '400',
        color: '#6B6B76',
        lineHeight: 17,
        marginBottom: 12,
    },
    addressFieldBlock: {
        marginBottom: 12,
    },
    addressFieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333333',
        marginBottom: 6,
    },
    locationFillBtn: {
        alignSelf: 'flex-start',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#0D8A4A',
        marginBottom: 14,
        minWidth: 200,
        alignItems: 'center',
        justifyContent: 'center',
    },
    locationFillBtnPressed: {
        opacity: 0.85,
    },
    locationFillBtnDisabled: {
        opacity: 0.6,
    },
    locationFillBtnText: {
        color: '#0D8A4A',
        fontWeight: '700',
        fontSize: 14,
    },
    processingDropdown: {
        minHeight: 50,
        borderColor: '#DCDCE0',
        borderWidth: 1,
        borderRadius: 5,
        paddingHorizontal: 14,
        backgroundColor: '#FAFAFA',
    },
    processingDropdownItem: {
        fontSize: 14,
        color: '#111111',
    },
    shippingTrackingLabel: {
        marginTop: 16,
    },
    evidenceGalleryRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 4,
        paddingRight: 4,
    },
    evidenceTile: {
        width: 104,
        height: 104,
        borderRadius: 8,
        overflow: "hidden",
        backgroundColor: "#ECECEF",
        borderWidth: 1,
        borderColor: "#DCDCE0",
    },
    evidenceImage: {
        width: "100%",
        height: "100%",
    },
    evidenceRemoveBtn: {
        position: "absolute",
        top: 4,
        right: 4,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: "rgba(0,0,0,0.55)",
        alignItems: "center",
        justifyContent: "center",
    },
    evidenceRemoveBtnPressed: {
        backgroundColor: "rgba(0,0,0,0.75)",
    },
    evidenceRemoveText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "600",
        lineHeight: 20,
        marginTop: -1,
    },
    evidenceAddTile: {
        width: 104,
        height: 104,
        borderRadius: 8,
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: "#0D8A4A",
        backgroundColor: "#F0FAF4",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 8,
    },
    evidenceAddTilePressed: {
        backgroundColor: "#DCEFE6",
    },
    evidenceAddPlus: {
        fontSize: 28,
        fontWeight: "300",
        color: "#0D8A4A",
        lineHeight: 32,
    },
    evidenceAddLabel: {
        fontSize: 11,
        fontWeight: "600",
        color: "#0D8A4A",
        marginTop: 2,
        textAlign: "center",
    },
    evidenceCountLabel: {
        marginTop: 10,
        fontSize: 12,
        fontWeight: "500",
        color: "#6B6B76",
    },
    actionBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 12,
        backgroundColor: "#fff",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E2E2E6',
    },
    btnAccept: {
        flex: 1,
        height: 44,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0D8A4A',
    },
    btnAcceptPressed: {
        backgroundColor: '#0A6B3A',
    },
    btnAcceptText: {
        fontSize: 13,
        fontWeight: '700',
        color: "#fff",
    },
    btnSecondary: {
        flex: 1,
        height: 44,
        borderRadius: 5,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F5F5F5",
        borderWidth: 1,
        borderColor: "#E0E0E0",
    },
    btnSecondaryPressed: {
        backgroundColor: "#EBEBEB",
    },
    btnSecondaryText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#111111",
    },
    btnReject: {
        flex: 1,
        height: 44,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#C62828',
    },
    btnRejectPressed: {
        backgroundColor: '#A01A1A',
    },
    btnRejectText: {
        fontSize: 13,
        fontWeight: '700',
        color: "#fff",
    },
    dropdownBlock: {
        width: '95%',
        alignSelf: 'center',
    },
    dropdown: {
        minHeight: 52,
        borderColor: '#E0E0E0',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 14,
        backgroundColor: '#FAFAFA',
        marginTop: 8,
    },
    dropdownContainer: {
        borderRadius: 8,
        borderColor: '#E0E0E0',
        borderWidth: 1,
    },
    placeholderStyle: {
        fontSize: 14,
        color: '#999999',
    },
    selectedTextStyle: {
        fontSize: 14,
        color: '#111111',
        fontWeight: '600',
    },
    itemTextStyle: {
        fontSize: 14,
        textTransform: "capitalize",
        color: '#111111',
    },
    inputSearchStyle: {
        height: 44,
        fontSize: 14,
        borderRadius: 8,
        borderColor: '#E0E0E0',
        borderWidth: 1,
        paddingHorizontal: 12,
    },
    iconStyle: {
        width: 20,
        height: 20,
        tintColor: '#999999',
    },
    errorText: {
        marginTop: 8,
        fontSize: 13,
        color: '#C62828',
        fontWeight: '500',
    },
    fieldErrorText: {
        marginTop: 4,
        fontSize: 12,
        color: '#C62828',
        fontWeight: '500',
    },
    textInputError: {
        borderColor: '#C62828',
        backgroundColor: '#FFF8F8',
    },
    processingDropdownError: {
        borderColor: '#C62828',
        backgroundColor: '#FFF8F8',
    },
    inputCnt: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginVertical: 8,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111111',
        marginBottom: 8,
    },
    acceptIntroText: {
        fontSize: 14,
        fontWeight: '400',
        color: '#333333',
        lineHeight: 22,
    },
    textInput: {
        borderColor: '#E0E0E0',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: '#111111',
        backgroundColor: '#FAFAFA',
    },
    textInputMultiline: {
        height: 100,
        textAlignVertical: 'top',
    },
    checkboxRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
    },
    checkboxRowPressed: {
        opacity: 0.75,
    },
    checkboxBox: {
        width: 22,
        height: 22,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: "#E0E0E0",
        backgroundColor: "#FAFAFA",
        alignItems: "center",
        justifyContent: "center",
    },
    checkboxBoxChecked: {
        backgroundColor: "#0D8A4A",
        borderColor: "#0D8A4A",
    },
    checkboxMark: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "700",
    },
    checkboxLabel: {
        flex: 1,
        fontSize: 14,
        fontWeight: "500",
        color: "#111111",
    },
})