import { IoCarOutline, IoChevronForward, IoPhonePortraitOutline, IoShieldCheckmarkOutline } from "react-icons/io5";

export default function CustomerHeaderHead() {
    const ups = [
        {
            Icon: IoCarOutline,
            iconColor: "#00926e",
            title: "Free shipping on all orders",
            chevron: true,
            summary: "Limited-time offer",
        },
        {
            Icon: IoShieldCheckmarkOutline,
            iconColor: "#00926e",
            title: "Delivery guarantee",
            summary: "Refund for any issues",
        },
        {
            Icon: IoPhonePortraitOutline,
            iconColor: "#00926e",
            title: "Get the DeeDyte App",
            summary: "",
        },
    ];

    return (
        <div className="deedyte-ups">
            {ups.map((data, i) => {
                const Icon = data.Icon;
                return (
                    <div className="deedyte-ups-item" key={i}>
                        <Icon size={22} color={data.iconColor} />
                        <div>
                            <h3>
                                {data.title}
                                {data.chevron ? <IoChevronForward size={12} /> : null}
                            </h3>
                            {data.summary ? <p>{data.summary}</p> : null}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
