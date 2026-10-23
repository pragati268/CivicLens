import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

const redCrossIcon = L.divIcon({
  className: "civiclens-red-cross-wrapper",
  html: '<span class="civiclens-red-cross">✖</span>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15],
});

export default function HazardMap({ reports = [] }) {
  const mapElement = useRef(null);
  const mapInstance = useRef(null);
  const markersLayer = useRef(null);

  const [mapError, setMapError] = useState("");
  const [mapReady, setMapReady] = useState(false);

  // Initialize the map only once.
  useEffect(() => {
    if (!mapElement.current || mapInstance.current) return;

    let map;

    try {
      map = L.map(mapElement.current).setView([31.634, 74.8723], 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      })
        .on("tileerror", () => {
          setMapError(
            "Map tiles could not load. Check your internet connection."
          );
        })
        .addTo(map);

      mapInstance.current = map;
      markersLayer.current = L.layerGroup().addTo(map);

      requestAnimationFrame(() => {
        if (!mapInstance.current) return;
        map.invalidateSize();
        setMapReady(true);
      });
    } catch (error) {
      queueMicrotask(() => {
        setMapError(error.message || "Map initialization failed.");
      });
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markersLayer.current = null;
      }
    };
  }, []);

  // Redraw markers whenever the reports array changes.
  useEffect(() => {
    const map = mapInstance.current;
    const layer = markersLayer.current;

    if (!map || !layer || !mapReady) return;

    layer.clearLayers();

    const validReports = reports.filter((report) => {
      const lat = Number(report.latitude);
      const lng = Number(report.longitude);

      return (
        report.latitude !== null &&
        report.latitude !== undefined &&
        report.longitude !== null &&
        report.longitude !== undefined &&
        report.latitude !== "" &&
        report.longitude !== "" &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      );
    });

    const markerBounds = [];

    validReports.forEach((report) => {
      const lat = Number(report.latitude);
      const lng = Number(report.longitude);

      const marker = L.marker([lat, lng], {
        icon: redCrossIcon,
        title: report.issue || report.title || "Reported hazard",
      });

      const popupContent = `
        <div class="civiclens-popup">
          <strong>${escapeHtml(report.issue || report.title || "Road hazard")}</strong>
          <p><b>Location:</b> ${escapeHtml(report.location || "Not provided")}</p>
          <p><b>Status:</b> ${escapeHtml(report.status || "Reported")}</p>
          <p><b>Priority:</b> ${escapeHtml(report.priority || "Medium")}</p>
          <p><b>Report ID:</b> ${escapeHtml(report.id ?? "N/A")}</p>
          ${
            report.description
              ? `<p>${escapeHtml(report.description)}</p>`
              : ""
          }
          <p><b>GPS:</b> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.addTo(layer);
      markerBounds.push([lat, lng]);
    });

    // Keep the default Amritsar view if there are no valid coordinates.
    if (markerBounds.length === 1) {
      map.setView(markerBounds[0], 15);
    } else if (markerBounds.length > 1) {
      map.fitBounds(markerBounds, { padding: [30, 30], maxZoom: 15 });
    }
  }, [reports, mapReady]);

  return (
    <div style={{ width: "100%" }}>
      {mapError && (
        <div style={{ padding: 12, color: "#dc2626" }}>
          {mapError}
        </div>
      )}

      {!mapReady && !mapError && (
        <div style={{ padding: 12 }}>Loading map...</div>
      )}

      <div
        ref={mapElement}
        style={{
          width: "100%",
          height: 450,
          minHeight: 450,
          background: "#e5e7eb",
          borderRadius: 12,
          overflow: "hidden",
        }}
      />

      {mapReady && (
        <p style={{ margin: "8px 0", fontSize: 13 }}>
          Showing {reports.filter((r) =>
            r.latitude != null &&
            r.longitude != null &&
            r.latitude !== "" &&
            r.longitude !== "" &&
            Number.isFinite(Number(r.latitude)) &&
            Number.isFinite(Number(r.longitude))
          ).length} GPS-tagged reports. Click a red ❌ to view details.
        </p>
      )}
    </div>
  );
}