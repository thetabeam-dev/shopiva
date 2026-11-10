"use client"
import "./styles/xxl.css";
import CustomerHeader from "@/components/customers/Header";
import CustomerHeaderHead from "@/components/customers/HeaderHead";
import Categories from "@/components/customers/HeaderCategories";
import CustomerHome from "@/components/customers/Home";

export default function Index() {


    return (
        <>
            <div className="buyer-head">
                <CustomerHeaderHead />
                <CustomerHeader />
                <Categories />
            </div>
            <CustomerHome />
        </>
    )
}
