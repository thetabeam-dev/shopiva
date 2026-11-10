"use client";

import { IoCartOutline, IoHeadsetOutline, IoPersonOutline, IoSearch } from "react-icons/io5";
import Link from "next/link";


export default function CustomerHeader() {

    return (
        <>
            <header className="buyer-header">
                <img src="/Deedyte.png" alt="" />

                <form
                    className="buyer-search"
                    role="search"
                    onSubmit={(event) => event.preventDefault()}
                >
                    <input
                        type="search"
                        name="q"
                        placeholder="What are you searching for?"
                        aria-label="Search"
                    />
                    <button type="submit" className="buyer-search__btn" aria-label="Search">
                        <IoSearch size={16} color="#fff" />
                    </button>
                </form>

                <div className="buyer-header-group">
                    <Link style={{
                        textDecoration: "none",
                        color: "#000"
                    }} className="buyer-auth" href={"/login"}>
                        <IoPersonOutline size={18} />
                        &nbsp;
                        <div>
                            <small style={{fontSize: "10px"}}>Register / Login</small>
                            <small style={{fontSize: "12px", fontWeight: "600"}}>Order & Account</small>
                        </div>
                    </Link>
                </div>
                <div className="buyer-header-group">
                   
                    <Link style={{
                        textDecoration: "none",
                        color: "#000",
                        background: "#fff"

                    }} href={"/cart"}>
                        <IoCartOutline color="#000" size={18} />
                    </Link>
                    &nbsp;
                    &nbsp;
                    &nbsp;

                    <Link style={{
                        textDecoration: "none",
                        color: "#000",
                        fontSize: "medium",
                        display: "flex",
                        alignItems: "center"
                    }} href={"/support"} >
                        <IoHeadsetOutline size={18} />
                        &nbsp;
                        <small>Support</small>
                    </Link>
                </div>

            </header>
        </>
    )
}