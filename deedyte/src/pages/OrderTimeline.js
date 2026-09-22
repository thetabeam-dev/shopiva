



export default function OrderTimeline(){

    return(
        <>

        </>
    )
}



function acceptOrder(){

    return(
        <>
            <View>
                <Text>Can you fullfill this order</Text>
                {/* code here */}
            </View>

            <View>
                <Text>How long will it take to start shipping (Estimated dispatch time)</Text>
                {/* code here */}
            </View>

            <View>
                <Text>Confirm that this item is available and matches the listing description.</Text>
                {/* code here */}
            </View>

            <View>
                <TouchableOpacity>

                </TouchableOpacity>
            </View>
        </>
    );
}


function shipItem(){

    return(
        <>
            <View>
                <Text>What delivery method will you use/used (3rd party, yourself)</Text>
                {/* code here */}
            </View>

            <View>
                <Text>Courier/Logistic name</Text>
                {/* code here */}
            </View>

            <View>
                <Text>Tracking number</Text>
                {/* code here */}
            </View>

            <View>
                <Text>Estimated delivery date</Text>
                {/* code here */}
            </View>

            <View>
                <Text>Shipment proof</Text>
                {/* code here */}
            </View>

        </>
    )
}


function outForPickup(){

    return(
        <>
            <View>
                <Text>is this package out for delivery</Text>
                {/* code here */}
            </View>

            <View>
                <Text>Current package location</Text>
                {/* code here */}
            </View>

            <View>
                <Text>Estimated delivery time</Text>
                {/* code here */}
            </View>

            <View>
                <Text>Delivery contact (optional)</Text>
                {/* code here */}
            </View>

            <View>
                <Text>Rider name (optional)</Text>
                {/* code here */}
            </View>
        </>
    )
}



function deliveredToBuyer(){


    return(
        <>
            <View>
                <Text>Did you receive/pick the item</Text>
                {/* code here */}
            </View>

            <View>
                <Text>Is the item in good condition</Text>
                {/* code here */}
            </View>
            <View>
                <Text>Are you satisfied with the item</Text>
                {/* code here */}
            </View>
        </>
    )
}