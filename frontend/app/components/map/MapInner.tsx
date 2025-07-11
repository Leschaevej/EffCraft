'use client';

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './Map.scss';
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/leaflet/marker-icon-2x.png',
    iconUrl: '/leaflet/marker-icon.png',
    shadowUrl: '/leaflet/marker-shadow.png',
});

export interface MapProps {
    lat: number;
    lng: number;
    name: string;
    address: string;
}

export default function MapInner({ lat, lng, name, address }: MapProps) {
    return (
        <MapContainer
            center={[lat, lng]}
            zoom={12}
            scrollWheelZoom={false}
            className="map"
        >
        <TileLayer
            attribution='Tiles © Esri — Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
        />
        <Marker position={[lat, lng]}>
            <Popup>
                <strong>{name}</strong><br />
                {address}
            </Popup>
        </Marker>
        </MapContainer>
    );
}
