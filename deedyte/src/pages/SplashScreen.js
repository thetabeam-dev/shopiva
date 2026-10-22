import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useRef } from "react";
import { Dimensions, Image, StyleSheet, Text, View } from "react-native";
// import "../assets/Deedyte.png"


const w = Dimensions.get("screen").width;
const h = Dimensions.get("screen").height;
export function SplashScreen(){

    let navigation = useNavigation()
    const continued = useRef(false)

    useEffect(() => {
        const timer = setTimeout(() => {
            continued.current = true
            navigation.replace("AuthPurpose");
        }, 2000);
        return () => clearTimeout(timer);
    }, [navigation])

    useFocusEffect(useCallback(() => {
        if (!continued.current) return undefined;
        navigation.replace("AuthPurpose");
        return undefined;
    }, [navigation]))

    

    return(
        <>
            <View style={styles.root}>
                <View style={{
                    display: "flex",
                    alignItems: "center",
                    flexDirection: "column",
                    justifyContent: "center"
                }}>
                    <Image style={{
                        height: 60,
                        width: 60,
                        marginBottom: 20
                    }} source={require("../assets/Deedyte.png")} />
                    <Text style={{
                        fontSize: 25
                    }}>
                        Deedyte
                    </Text>
                </View>

                <Text>
                    Sponsored By THETABEAM
                </Text>
            </View>
        </>
    )
}


const styles = StyleSheet.create({


    root: {
        height: h,
        width: w,
        backgroundColor: "#fff",
        display: "flex",
        alignItems: "center",
        flexDirection: "column",
        justifyContent: "space-evenly"
    },



})