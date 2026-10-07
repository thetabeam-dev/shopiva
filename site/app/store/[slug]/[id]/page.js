export const dynamic = "force-dynamic";
export const revalidate = 0;

import ProductDetail from "./product"; // Client component

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

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
  const slug = typeof resolved?.slug === "string" ? resolved.slug : String(resolved?.slug ?? "");
  const id = typeof resolved?.id === "string" ? resolved.id : String(resolved?.id ?? "");
  return { slug, id };
}

/** Storefront product for this shop, plus reviews and the shop name. */
async function loadStorefrontProduct(slug, id) {
  const productId = parseInt(String(id), 10);
  if (!BACKEND_URL || !slug || !Number.isFinite(productId)) return null;

  const [prodRes, shopRes] = await Promise.all([
    fetch(`${BACKEND_URL}/storefront/product/${productId}`, { cache: "no-store" }),
    fetch(`${BACKEND_URL}/storefront/shop/${encodeURIComponent(slug)}`, { cache: "no-store" }),
  ]);
  if (!prodRes.ok) return null;

  const prod = await prodRes.json().catch(() => ({}));
  const shop = shopRes.ok ? await shopRes.json().catch(() => ({})) : {};
  if (!prod?.product) return null;

  return {
    ...prod.product,
    productReviews: Array.isArray(prod.productReviews) ? prod.productReviews : [],
    reviewMetrics: prod.reviewMetrics ?? null,
    shopName: shop?.shop?.name ? String(shop.shop.name) : "",
  };
}

export async function generateMetadata({ params }) {
  const { slug, id } = await readRouteParams(params);

  if (!slug || !id) {
    return { title: "Default Product" };
  }

  try {
    const product = await loadStorefrontProduct(slug, id);

    console.log('product: ', product)
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

    const formattedTitle = `${product?.name ?? product?.title ?? slug} - ₦${new Intl.NumberFormat(
      "en-US"
    ).format(product?.price ?? product.minPrice ?? 0)}`;

    return {
      title: formattedTitle,
      alternates: {
        canonical: `https://www.deedyte.com/store/${slug}/${product?.id}`,
      },
      url: `https://www.deedyte.com/store/${slug}/${product?.id}`,
      robots: {
        index: true,
        follow: true,
      },
      openGraph: {
        title: formattedTitle,
        description: product?.description || "",
        url: `https://www.deedyte.com/store/${slug}/${product?.id}`,
        type: isImg ? "website" : "video.other",
        ...(isImg
          ? {
              images: [{ url: ogImage, width: 1200, height: 630, type: "image/jpeg" }],
            }
          : {
              videos: [
                {
                  url: videoUrl,
                  secure_url: videoUrl,  // 👈 Add this for HTTPS
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
              playerStream: videoUrl, // Direct MP4 link
              playerStreamContentType: "video/mp4",
              playerWidth: 1280,
              playerHeight: 720
            }
          ),
      },
    };
  } catch (error) {
    console.error("Metadata fetch error:", error);
    return { title: "Product Details - DeeDyte" };
  }
}

export default async function ProductPage({ params }) {
  const { slug, id } = await readRouteParams(params);

  if (!slug || !id) {
    return <div>Error: No product provided.</div>;
  }

  try {
    const product = await loadStorefrontProduct(slug, id);
    if (!product) {
      return <div>Error loading product. Please try again later.</div>;
    }
    return <ProductDetail slug={slug} product={product} />;
  } catch (error) {
    console.error("Error fetching product:", error);
    return <div>Error loading product. Please try again later.</div>;
  }
}
