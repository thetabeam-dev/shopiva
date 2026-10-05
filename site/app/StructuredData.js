// components/StructuredData.js
"use client"
// import Script from 'next/script';
export default function StructuredData({ data }) {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
        // strategy="beforeInteractive"
        />
    );
}