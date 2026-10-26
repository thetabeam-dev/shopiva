import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useRef } from "react";
import { AppState, Dimensions, Image, StyleSheet, Text, View } from "react-native";

const w = Dimensions.get("screen").width;
const h = Dimensions.get("screen").height;

export function SplashScreen() {
    const navigation = useNavigation();
    const continued = useRef(false);

    const goNext = useCallback(() => {
        if (continued.current) return;
        if (AppState.currentState !== 'active') return;
        continued.current = true;
        navigation.replace("AuthPurpose");
    }, [navigation]);

    useEffect(() => {
        const timer = setTimeout(goNext, 2000);
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
        navigation.replace("AuthPurpose");
        return undefined;
    }, [navigation]));

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
