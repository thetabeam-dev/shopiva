export const dynamic = "force-dynamic";
export const revalidate = 0;

import nextDynamic from "next/dynamic";
import StructuredData from "@/app/StructuredData";
import { productJsonLd } from "@/lib/productStructuredData";
import { getStorefrontProductById } from "@/lib/storefrontProducts";
import CustomerHeader from "@/components/customers/Header";
import CustomerHeaderHead from "@/components/customers/HeaderHead";
import "@/app/styles/xxl.css";

const ProductDetail = nextDynamic(() => import("./product"), {
  ssr: false,
  loading: () => <div>Loading product…</div>,
});

/** JPEG 1200×630 so WhatsApp can preview the link. Facebook accepts WebP; WhatsApp does not. */
function whatsappOgImage(url) {
  const raw = String(url ?? "").trim();
  if (!raw.includes("/image/upload/")) return raw;
  return raw.replace(
    "/image/upload/",
    "/image/upload/f_jpg,c_fill,w_1200,h_630,q_auto/",
  );
}

async function readRouteParams(params) {
  const resolved = params && typeof params.then === "function" ? await params : params;
  const id = typeof resolved?.id === "string" ? resolved.id : String(resolved?.id ?? "");
  return { id };
}

async function loadStorefrontProduct(id) {
  try {
    return await getStorefrontProductById(id);
  } catch (error) {
    console.error("Storefront product lookup failed:", error);
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { id } = await readRouteParams(params);

  if (!id) {
    return { title: "Default Product" };
  }

  try {
    const product = await loadStorefrontProduct(id);

    if (!product || Object.keys(product).length === 0) {
      return { title: "Product Not Found" };
    }

    const thumbnail = Array.isArray(product?.images) && product.images[0]
      ? product.images[0]
      : "";
    const videoUrl = Array.isArray(product?.videos) && product.videos[0]
      ? product.videos[0]
      : "";
    const ogImage = whatsappOgImage(thumbnail);
    const isImg = Boolean(ogImage) && (
      ogImage.includes("/image/upload/") ||
      ["jpg", "jpeg", "png", "gif"].includes(
        String(thumbnail).split(".").pop()?.split("?")[0]?.toLowerCase()
      )
    );

    const formattedTitle = `${product?.name ?? product?.title ?? id} - ₦${new Intl.NumberFormat(
      "en-US"
    ).format(product?.price ?? product.minPrice ?? 0)}`;

    const pageUrl = `https://www.deedyte.com/${product?.id}`;

    return {
      title: formattedTitle,
      alternates: {
        canonical: pageUrl,
      },
      url: pageUrl,
      robots: {
        index: true,
        follow: true,
      },
      openGraph: {
        title: formattedTitle,
        description: product?.description || "",
        url: pageUrl,
        type: isImg ? "website" : "video.other",
        ...(isImg
          ? {
              images: [{ url: ogImage, width: 1200, height: 630, type: "image/jpeg" }],
            }
          : {
              videos: [
                {
                  url: videoUrl,
                  secure_url: videoUrl,
                  width: 1280,
                  height: 720,
                  type: "video/mp4",
                },
              ],
            }),
      },
      twitter: {
        card: isImg ? "summary_large_image" : "player",
        title: formattedTitle,
        description: product?.description || "",
        ...(isImg
          ? { images: [ogImage] }
          : {
              player: videoUrl,
              playerStream: videoUrl,
              playerStreamContentType: "video/mp4",
              playerWidth: 1280,
              playerHeight: 720,
            }),
      },
    };
  } catch (error) {
    console.error("Metadata fetch error:", error);
    return { title: "Product Details - DeeDyte" };
  }
}

export default async function ProductPage({ params }) {
  const { id } = await readRouteParams(params);

  if (!id) {
    return <div>Error: No product provided.</div>;
  }

  try {
    const product = await loadStorefrontProduct(id);
    if (!product) {
      return <div>Error loading product. Please try again later.</div>;
    }
    return (
      <>
        <StructuredData data={productJsonLd(product)} />
        <div className="buyer-head">
          <CustomerHeaderHead />
          <CustomerHeader />
        </div>
        <ProductDetail product={product} />
      </>
    );
  } catch (error) {
    console.error("Error fetching product:", error);
    return <div>Error loading product. Please try again later.</div>;
  }
}
