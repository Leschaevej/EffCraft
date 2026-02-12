'use client';

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './RelayMap.scss';
import L from 'leaflet';
import type { RelayPoint, RelayMapProps } from './RelayMap';

const defaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});
const selectedIcon = defaultIcon;
export default function RelayMapInner({
    points,
    center,
    onSelectPoint,
    selectedPointId
}: RelayMapProps) {
    return (
        <MapContainer
            center={center}
            zoom={13}
            scrollWheelZoom={true}
            className="map"
        >
            <TileLayer
                attribution='Tiles © Esri — Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
            />
            {points.map((point) => (
                <Marker
                    key={point.id}
                    position={[point.latitude, point.longitude]}
                    icon={defaultIcon}
                >
                    <Popup closeButton={false}>
                        <div className="popup">
                            <strong>{point.name}</strong>
                            {point.address}<br />
                            {point.zipcode} {point.city}
                            <div className="bottom">
                                {point.distance && (
                                    <em>À {(point.distance / 1000).toFixed(1)} km</em>
                                )}
                                <button
                                    className="button"
                                    onClick={() => onSelectPoint(point)}
                                >
                                    Choisir ce point
                                </button>
                            </div>
                        </div>
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}