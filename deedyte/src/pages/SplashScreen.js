import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useRef } from "react";
import { AppState, Dimensions, Image, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../hooks/useAuth";
import { loadPendingDeferredLink } from "../auth/deferredLink";

const w = Dimensions.get("screen").width;
const h = Dimensions.get("screen").height;

/** Max time the splash waits for Google Play to return the install referrer. */
const REFERRER_WAIT_MS = 3000;

export function SplashScreen() {
    const navigation = useNavigation();
    const { setPreAuthChoice } = useAuth();
    const continued = useRef(false);
    const timerDone = useRef(false);
    /** @type {React.MutableRefObject<null | 'customer' | 'default'>} */
    const destination = useRef(null);

    const replaceToDestination = useCallback(() => {
        if (destination.current === 'customer') {
            navigation.replace("Login", { allowSkip: true, intentRole: 'customer' });
            return;
        }
        navigation.replace("AuthPurpose");
    }, [navigation]);

    const goNext = useCallback(() => {
        if (continued.current) return;
        if (!timerDone.current || destination.current == null) return;
        if (AppState.currentState !== 'active') return;
        continued.current = true;
        replaceToDestination();
    }, [replaceToDestination]);

    useEffect(() => {
        let cancelled = false;
        const timeout = new Promise((resolve) => {
            setTimeout(() => resolve(null), REFERRER_WAIT_MS);
        });
        Promise.race([loadPendingDeferredLink(), timeout])
            .then(async (link) => {
                if (cancelled) return;
                if (link) {
                    await setPreAuthChoice('customer').catch(() => {});
                    destination.current = 'customer';
                } else {
                    destination.current = 'default';
                }
            })
            .catch(() => {
                destination.current = 'default';
            })
            .finally(() => {
                if (!cancelled) goNext();
            });
        return () => {
            cancelled = true;
        };
    }, [goNext, setPreAuthChoice]);

    useEffect(() => {
        const timer = setTimeout(() => {
            timerDone.current = true;
            goNext();
        }, 2000);
        const sub = AppState.addEventListener('change', (next) => {
            if (next === 'active') goNext();
        });
        return () => {
            clearTimeout(timer);
            sub.remove();
        };
    }, [goNext]);

    useFocusEffect(useCallback(() => {
        if (!continued.current) return undefined;
        replaceToDestination();
        return undefined;
    }, [replaceToDestination]));

    return (
        <View style={styles.root}>
            <View style={styles.brand}>
                <Image
                    style={styles.logo}
                    source={require("../assets/Deedyte.png")}
                />
                <Text style={styles.title}>Deedyte</Text>
            </View>
            <Text>Sponsored By THETABEAM</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        height: h,
        width: w,
        backgroundColor: "#fff",
        display: "flex",
        alignItems: "center",
        flexDirection: "column",
        justifyContent: "space-evenly",
    },
    brand: {
        display: "flex",
        alignItems: "center",
        flexDirection: "column",
        justifyContent: "center",
    },
    logo: {
        height: 60,
        width: 60,
        marginBottom: 20,
    },
    title: {
        fontSize: 25,
    },
});
