import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import '../../globals.css';
import Sidebar from './Sidebar';
import axios from 'axios';
import { tsp } from '../utils/tsp';
import { Feature, LineString } from 'geojson';

mapboxgl.accessToken = 'pk.eyJ1IjoibWFzaGJ1cm4iLCJhIjoiY2x3MnVlcWZmMGtpeTJxbzA5ZXNmb3V0MCJ9.E-W6jVgrBjtiZL-mUJhUAw';

// Define the types
type Location = {
  id: string;
  geometry: {
    coordinates: [number, number];
  };
};

type Route = {
  type: string;
  coordinates: number[][];
};

type TSPResult = {
  path: number[];
};

const Map = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [lng, setLng] = useState<number>(-71.06);
  const [lat, setLat] = useState<number>(42.35);
  const [zoom, setZoom] = useState<number>(13);
  const [Locations, setLocations] = useState<Location[]>([]);
  const [Routes, setRoutes] = useState<Route[]>([]);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const [result, setResult] = useState<TSPResult>({ path: [] });
  const [path, setPath] = useState<Location[]>([]);
  const [Duration, setDuration] = useState<number>(0);
  const [distanceMatrix, setDistanceMatrix] = useState<number[][]>([]);

  useEffect(() => {
    if (distanceMatrix.length > 0) {
      const tspResult = tsp(distanceMatrix);
      setResult(tspResult);
      console.log(tspResult);
    }
  }, [distanceMatrix]);

  const addLocation = (newLocation: Location) => {
    setLocations((prevLocations) => {
      if (prevLocations.some(location => location.id === newLocation.id)) {
        return prevLocations;
      }
      return [...prevLocations, newLocation];
    });
  };

  const removeLocation = (removedLocation: Location) => {
    setLocations((prevLocations) => {
      return prevLocations.filter((location) => location.id !== removedLocation.id);
    });
  };

  const handleFindDistances = async () => {
    const distances = Array.from({ length: Locations.length }, () =>
      Array.from({ length: Locations.length }, () => Infinity)
    );
    for (let i = 0; i < Locations.length; i++) {
      for (let j = 0; j < Locations.length; j++) {
        const origin = Locations[i].geometry.coordinates.join(',');
        const destination = Locations[j].geometry.coordinates.join(',');
        try {
          const routeData = await calcRouteDirection(origin, destination);
          const distance = routeData.routes[0].distance;
          distances[i][j] = distance / 1000;
          distances[j][i] = distance / 1000;
        } catch (error) {
          console.error(`Error calculating distance between ${origin} and ${destination}:`, error);
        }
      }
    }
    setDistanceMatrix(distances);
  };

  const calcRouteDirection = async (origin: string, destination: string) => {
    try {
      const response = await axios.get(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${origin};${destination}?alternatives=true&geometries=geojson&language=en&overview=full&steps=true&access_token=${mapboxgl.accessToken}`
      );
      return response.data;
    } catch (error) {
      console.error('Error calculating directions:', error);
      throw error;
    }
  };

  const addMarker = (Location: Location) => {
    addLocation(Location);
    const id = Location.id;
    const long = Location.geometry.coordinates[0];
    const lat = Location.geometry.coordinates[1];
    map.current!.flyTo({ center: [long, lat], zoom: 13 });
    const marker = new mapboxgl.Marker({ color: '#E0E0E0' })
      .setLngLat([long, lat])
      .addTo(map.current!);
    markers.current[id] = marker;
  };

  const deleteMarker = (Location: Location) => {
    const id = Location.id;
    const marker = markers.current[id];
    marker.remove();
    delete markers.current[id];
  };

  const handleremovelocation = (locationDetails: Location) => {
    removeLocation(locationDetails);
    deleteMarker(locationDetails);
    if (Locations.length < 2) {
      setPath([]);
    }
  };

  const handlelocationData = (locationDetails: Location) => {
    addMarker(locationDetails);
  };

  const removeRoutes = (map: mapboxgl.Map | null, routes: Route[]) => {
    if (map && routes.length > 0) {
      routes.forEach((_, index: number) => {
        const routeId = 'route' + index;
        if (map.getSource(routeId)) {
          map.removeLayer(routeId);
          map.removeSource(routeId);
        }
      });
    }
  };

  useEffect(() => {
    removeRoutes(map.current, Routes);
    if (Locations.length > 1) {
      const updateRoutesAsync = async () => {
        let updatedRoutes: Route[] = [];
        let updatedPath: Location[] = [];
        let time = 0;
        for (let i = 0; i < Locations.length - 1; i++) {
          if (result.path) {
            const origin = Locations[result.path[i]].geometry.coordinates.join(',');
            const destination = Locations[result.path[i + 1]].geometry.coordinates.join(',');
            updatedPath.push(Locations[result.path[i]]);
            try {
              const routeGeo = await calcRouteDirection(origin, destination);
              updatedRoutes.push(routeGeo.routes[0].geometry);
              time += routeGeo.routes[0].duration;
            } catch (error) {
              console.error("Error calculating route direction:", error);
            }
          }
        }
        if (result.path) {
          updatedPath.push(Locations[result.path[Locations.length - 1]]);
        }
        setDuration(time);
        setRoutes(updatedRoutes);
        setPath(updatedPath);
      };
      updateRoutesAsync();
    }
  }, [Locations, result]);

  useEffect(() => {
    console.log('Selected Location: ', Locations.length);
    if (Locations.length > 1) {
      handleFindDistances();
    } else {
      setPath([]);
      setResult({ path: [] });
      setDuration(0);
    }
  }, [Locations]);

  const addRoute = (map: mapboxgl.Map | null, routes: Route[]) => {
    if (map && routes.length > 0) {
      routes.forEach((route, index) => {
        const routeId = 'route' + index;
        const smoothRoute = getSmoothRoute(route.coordinates);
        if (map.getSource(routeId)) {
          map.removeLayer(routeId);
          map.removeSource(routeId);
        }
        map.addSource(routeId, {
          type: 'geojson',
          data: smoothRoute,
        });
        map.addLayer({
          id: routeId,
          type: 'line',
          source: routeId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#ec7a1c',
            'line-width': 5,
            'line-opacity': 1,
          },
        });
      });
    }
  };

  const getSmoothRoute = (coordinates: number[][]): Feature<LineString> => {
    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coordinates,
      },
      properties: {},
    };
  };

  const fetchLocation = async (lng: number, lat: number) => {
    try {
      const response = await axios.get(
        `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&access_token=${mapboxgl.accessToken}`
      );
      addMarker(response.data.features[0]);
    } catch (error) {
      console.error('Error fetching location:', error);
    }
  };

  useEffect(() => {
    addRoute(map.current, Routes);
    console.log('Routes:', Routes);
  }, [map, Routes]);

  useEffect(() => {
    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/dark-v9',
        center: [lng, lat],
        zoom: zoom,
      });
      map.current.on('move', () => {
        setLng(parseFloat(map.current!.getCenter().lng.toFixed(4)));
        setLat(parseFloat(map.current!.getCenter().lat.toFixed(4)));
        setZoom(parseFloat(map.current!.getZoom().toFixed(2)));
      });
      map.current.on('click', (event) => {
        fetchLocation(event.lngLat.lng, event.lngLat.lat);
      });
    }
  }, []);

  return (
    <>
      <Sidebar
        sendLocation={handlelocationData}
        updateLocation={handleremovelocation}
        results={result}
        path={path}
        time={Duration}
      />
      <div ref={mapContainer} className="map-container absolute top-0 left-0 right-0 bottom-0" />
    </>
  );
};

export default Map;
