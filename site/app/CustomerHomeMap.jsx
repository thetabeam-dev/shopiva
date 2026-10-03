"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, Tooltip, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Southwest and northeast corners approximating Nigeria’s territory (OSM-style [lat, lng]).
 * Used so the default map frames Nigeria instead of a world/continent view.
 */
const NIGERIA_BOUNDS = [
  [4.02, 2.67],
  [13.95, 14.68],
];
/** Street-level zoom when a fix is acquired (was 15; higher reads clearly “zoomed in”). */
const LOCATE_ZOOM = 17;

/** After Explore: at least this zoom so cities/towns show clearly on OSM (user-requested ~10). */
const EXPLORE_MIN_ZOOM_CITY = 10;
/** Cap zoom so the view stays city/regional, not building-level. */
const EXPLORE_MAX_ZOOM = 12;

function fixLeafletIcons() {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
}

function escapeHtml(text) {
  if (typeof window === "undefined") return String(text);
  const el = document.createElement("div");
  el.textContent = text;
  return el.innerHTML;
}

function escapeAttr(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

const vendorIconCache = new Map();

/**
 * Pin + shop label. Green dot = same state as buyer; yellow = different / unknown buyer state.
 */
function vendorMarkerIcon(shopName, sameState) {
  const key = shopName || "Shop";
  const cacheKey = `${key}|${sameState ? "g" : "y"}`;
  if (vendorIconCache.has(cacheKey)) return vendorIconCache.get(cacheKey);
  const short =
    key.length > 16 ? `${escapeHtml(key.slice(0, 14))}…` : escapeHtml(key);
  const dotClass = sameState
    ? "customer-vendor-marker__dot customer-vendor-marker__dot--same-state"
    : "customer-vendor-marker__dot customer-vendor-marker__dot--other-state";
  const icon = L.divIcon({
    className: "customer-vendor-marker-wrap",
    html: `<div class="customer-vendor-marker" role="img" aria-label="${escapeAttr(key)}"><span class="${dotClass}"></span><span class="customer-vendor-marker__name">${short}</span></div>`,
    iconSize: [96, 44],
    iconAnchor: [48, 36],
  });
  vendorIconCache.set(cacheKey, icon);
  return icon;
}

/**
 * First update after mount flies and zooms in; later updates (e.g. watchPosition) pan smoothly.
 */
function MapFollowPosition({ lat, lng }) {
  const map = useMap();
  const firstForThisMarker = useRef(true);

  useEffect(() => {
    if (lat == null || lng == null) return;

    let raf = 0;
    const apply = () => {
      map.invalidateSize();
      if (firstForThisMarker.current) {
        map.flyTo([lat, lng], LOCATE_ZOOM, { duration: 1.05 });
        firstForThisMarker.current = false;
      } else {
        map.panTo([lat, lng], { animate: true, duration: 0.35, easeLinearity: 0.25 });
      }
    };

    map.whenReady(() => {
      raf = requestAnimationFrame(apply);
    });

    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [lat, lng, map]);

  return null;
}

/** Vendors returned from `/discover/vendors` may omit coordinates; map layers need finite lat/lng. */
function vendorsWithValidCoords(vendors) {
  return (vendors || []).filter(
    (v) => v && Number.isFinite(v.lat) && Number.isFinite(v.lng)
  );
}

/**
 * After “Explore vendors”: if any vendors match the buyer’s state, fit the map to those first
 * so they fill ~70% of the view (15% padding on each side). Otherwise fit all vendors (+ user).
 */
function MapFitVendorsAndUser({ vendors, userPosition, exploreSession }) {
  const map = useMap();
  const prevSession = useRef(0);

  useEffect(() => {
    if (!exploreSession || exploreSession === prevSession.current) return;
    const geoVendors = vendorsWithValidCoords(vendors);
    if (!geoVendors.length) {
      prevSession.current = exploreSession;
      return;
    }
    prevSession.current = exploreSession;

    const run = () => {
      map.invalidateSize();
      const inBuyerState = geoVendors.filter((v) => v.sameState);
      const useInState = inBuyerState.length > 0;
      const subset = useInState ? inBuyerState : geoVendors;
      const corners = subset.map((v) => [v.lat, v.lng]);
      if (
        !useInState &&
        userPosition &&
        Number.isFinite(userPosition.lat) &&
        Number.isFinite(userPosition.lng)
      ) {
        corners.push([userPosition.lat, userPosition.lng]);
      }

      const size = map.getSize();
      const padX = Math.max(20, Math.round(size.x * 0.08));
      const padY = Math.max(20, Math.round(size.y * 0.08));

      if (corners.length === 1) {
        const z = Math.min(
          EXPLORE_MAX_ZOOM,
          Math.max(EXPLORE_MIN_ZOOM_CITY, useInState ? 12 : 11)
        );
        map.flyTo(corners[0], z, { animate: true, duration: 0.85 });
        return;
      }
      const b = L.latLngBounds(corners);
      const onMoveEnd = () => {
        map.off("moveend", onMoveEnd);
        let z = map.getZoom();
        const spanLat = b.getNorth() - b.getSouth();
        const spanLng = Math.abs(b.getEast() - b.getWest());
        const localEnough = spanLat < 4 && spanLng < 4;
        if (localEnough && z < EXPLORE_MIN_ZOOM_CITY) {
          map.setZoom(EXPLORE_MIN_ZOOM_CITY);
        }
        if (z > EXPLORE_MAX_ZOOM) {
          map.setZoom(EXPLORE_MAX_ZOOM);
        }
      };
      map.on("moveend", onMoveEnd);
      map.fitBounds(b, {
        padding: [padY, padX],
        maxZoom: EXPLORE_MAX_ZOOM,
        animate: true,
      });
    };

    map.whenReady(() => {
      requestAnimationFrame(run);
    });
  }, [map, vendors, userPosition, exploreSession]);

  return null;
}

/** Leaflet needs invalidateSize when the map pane height changes (e.g. 70/30 layout). */
function MapInvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const tick = () => {
      map.invalidateSize();
    };
    const el = map.getContainer();
    const parent = el?.parentElement;
    window.addEventListener("resize", tick);
    const ro =
      typeof ResizeObserver !== "undefined" && parent
        ? new ResizeObserver(tick)
        : null;
    if (ro && parent) ro.observe(parent);
    requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("resize", tick);
      if (ro && parent) ro.unobserve(parent);
      ro?.disconnect();
    };
  }, [map]);
  return null;
}

/**
 * OpenStreetMap in the top pane; default view fits Nigeria. User marker when `position` is set;
 * vendor markers from explore flow.
 *
 * @param {{ lat: number, lng: number } | null} position
 * @param {number} locateSession increments on each successful "use my location" so the map flies again
 * @param {Array<{ id: number, name: string, lat?: number | null, lng?: number | null, slug?: string, sameState?: boolean, address?: string | null, city?: string | null, state?: string | null }>} vendors
 * @param {number} exploreSession increments when vendors are loaded from “Explore vendors”
 */
export default function CustomerHomeMap({
  position,
  locateSession = 0,
  vendors = [],
  exploreSession = 0,
}) {
  useEffect(() => {
    fixLeafletIcons();
  }, []);

  const geoVendors = vendorsWithValidCoords(vendors);

  return (
    <div className="customer-home-map-root">
      <MapContainer
        bounds={NIGERIA_BOUNDS}
        boundsOptions={{ padding: [20, 20] }}
        className="customer-home-map-root__leaflet"
        scrollWheelZoom
        zoomControl
        attributionControl
      >
        <MapInvalidateOnResize />
        <MapFitVendorsAndUser
          vendors={geoVendors}
          userPosition={position}
          exploreSession={exploreSession}
        />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {position ? (
          <>
            <Marker position={[position.lat, position.lng]}>
              <Tooltip direction="top" offset={[0, -28]} opacity={1}>
                You
              </Tooltip>
            </Marker>
            <MapFollowPosition
              key={locateSession}
              lat={position.lat}
              lng={position.lng}
            />
          </>
        ) : null}
        {geoVendors.map((v) => {
          const label = v.name?.trim() || "Shop";
          const sameState = Boolean(v.sameState);
          const regionHint = sameState
            ? "Same state as you"
            : "Different state (or location not shared)";
          const streetOrLine = v.address?.trim() || "";
          const town = v.city?.trim() || "";
          const stateName = v.state?.trim() || "";
          const localityLines = [streetOrLine, town].filter(Boolean);
          return (
            <Marker
              key={v.id}
              position={[v.lat, v.lng]}
              icon={vendorMarkerIcon(label, sameState)}
            >
              <Tooltip direction="top" offset={[0, -36]} opacity={1}>
                {label} — tap to visit shop
              </Tooltip>
              <Popup>
                <div className="customer-vendor-popup">
                  <div className="customer-vendor-popup__title">{label}</div>
                  {localityLines.length > 0 ? (
                    <div className="customer-vendor-popup__address">
                      {streetOrLine ? (
                        <div className="customer-vendor-popup__line">{streetOrLine}</div>
                      ) : null}
                      {town ? (
                        <div className="customer-vendor-popup__line">{town}</div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="customer-vendor-popup__muted">No street or town on file</div>
                  )}
                  {stateName ? (
                    <div className="customer-vendor-popup__line customer-vendor-popup__state">
                      {stateName}
                    </div>
                  ) : null}
                  <div className="customer-vendor-popup__hint">{regionHint}</div>
                  {v.slug ? (
                    <Link
                      href={`/store/${encodeURIComponent(v.slug)}`}
                      className="customer-vendor-popup__visit"
                    >
                      Visit shop
                    </Link>
                  ) : (
                    <p className="customer-vendor-popup__muted customer-vendor-popup__visit-missing">
                      Visit shop (URL not set)
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
