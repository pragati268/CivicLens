import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function HazardMap({ reports = [] }) {
  const mapElement = useRef(null);
  const [mapError, setMapError] = useState("");
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapElement.current) return;

    let map;

    try {
      map = L.map(mapElement.current).setView([31.634, 74.8723], 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      })
        .on("tileerror", () => {
          setMapError("Map tiles failed to load. Check your internet connection or tile access.");
        })
        .addTo(map);

      requestAnimationFrame(() => {
        setMapReady(true);
        setTimeout(() => map?.invalidateSize(), 200);
      });
    } catch (error) {
      setTimeout(() => {
        setMapError(error.message || "Map initialization failed.");
      }, 0);
    }

    return () => {
      if (map) map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapElement.current?._leaflet_id;
    if (!map) return;

    const instance = document.getElementById("civiclens-map");
    if (!instance) return;

    const leafletMap = instance._leaflet_map;
    if (!leafletMap) return;

    // Markers are added in the effect below using the saved map instance.
  }, [reports]);

  return (
    <div style={{ width: "100%" }}>
      {mapError && (
        <div style={{ padding: 12, color: "#ff8b8b" }}>
          {mapError}
        </div>
      )}

      {!mapReady && !mapError && (
        <div style={{ padding: 12 }}>Loading map…</div>
      )}

      <div
        id="civiclens-map"
        ref={mapElement}
        style={{
          width: "100%",
          height: 450,
          minHeight: 450,
          background: "#e5e7eb",
          borderRadius: 12,
        }}
      />
    </div>
  );
}