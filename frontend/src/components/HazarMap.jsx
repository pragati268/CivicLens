import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const defaultCenter = [31.634, 74.872];

const hazardIcon = new L.DivIcon({
  className: "hazard-marker",
  html: '<div class="hazard-marker-inner">!</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function FitMarkers({ reports }) {
  const map = useMap();

  useEffect(() => {
    const points = reports
      .filter(
        (r) =>
          r.latitude != null &&
          r.longitude != null &&
          Number.isFinite(Number(r.latitude)) &&
          Number.isFinite(Number(r.longitude)) &&
          Math.abs(Number(r.latitude)) <= 90 &&
          Math.abs(Number(r.longitude)) <= 180
      )
      .map((r) => [Number(r.latitude), Number(r.longitude)]);

    if (points.length === 1) {
      map.setView(points[0], 15);
    } else if (points.length > 1) {
      map.fitBounds(points, { padding: [30, 30], maxZoom: 15 });
    }
  }, [reports, map]);

  return null;
}

export default function HazardMap({ reports = [] }) {
  const [highOnly, setHighOnly] = useState(false);

  const mappedReports = reports.filter((r) => {
    const hasCoordinates =
      r.latitude != null &&
      r.longitude != null &&
      Number.isFinite(Number(r.latitude)) &&
      Number.isFinite(Number(r.longitude)) &&
      Math.abs(Number(r.latitude)) <= 90 &&
      Math.abs(Number(r.longitude)) <= 180;

    return hasCoordinates && (!highOnly || r.priority === "High");
  });

  return (
    <section className="map-section">
      <div className="map-toolbar">
        <div>
          <h3>Road hazard map</h3>
          <p>{mappedReports.length} mapped hazard(s)</p>
        </div>

        <label className="map-filter">
          <input
            type="checkbox"
            checked={highOnly}
            onChange={(e) => setHighOnly(e.target.checked)}
          />
          High priority only
        </label>
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={12}
        scrollWheelZoom
        className="hazard-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitMarkers reports={mappedReports} />

        {mappedReports.map((report) => (
          <Marker
            key={report.id}
            position={[
              Number(report.latitude),
              Number(report.longitude),
            ]}
            icon={hazardIcon}
          >
            <Popup>
              <strong>{report.issue}</strong>
              <br />
              {report.location}
              <br />
              Priority: {report.priority}
              <br />
              Status: {report.status}
              <br />
              Report ID: {report.id}
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {mappedReports.length === 0 && (
        <p className="map-empty">
          No GPS-tagged reports match this filter yet.
          Submit a report using the location button to add a marker.
        </p>
      )}
    </section>
  );
}