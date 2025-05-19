import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import '../../globals.css';
import Sidebar from './Sidebar';
import axios from 'axios';
import { tsp } from '../utils/tsp';

const Map = () => {
  mapboxgl.accessToken = 'pk.eyJ1IjoidGVqYXMwNzA5IiwiYSI6ImNtYXZndXUzbDA0YmEya215bnBoNWduZGQifQ.onAiJPjdHG5fYSwKASXVmw';

  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [lng, setLng] = useState<number>(-71.06);
  const [lat, setLat] = useState<number>(42.35);
  const [zoom, setZoom] = useState<number>(13);
  const [locations, setLocations] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const [, setMarkersState] = useState<mapboxgl.Marker[]>([]);
  const [result, setResult] = useState<{ path?: number[], cost?: number }>({});
  const [path, setPath] = useState<any[]>([]);
  const [duration, setDuration] = useState<number>(0);
  const [distanceMatrix, setDistanceMatrix] = useState<number[][]>([]);

  useEffect(() => {
    if (distanceMatrix.length > 0) {
      const tspResult = tsp(distanceMatrix);
      setResult(tspResult);
      console.log(tspResult);
    }
  }, [distanceMatrix]);

  const addLocation = (newLocation: any) => {
    setLocations((prevLocations) => {
      if (prevLocations.some(location => location.id === newLocation.id)) {
        return prevLocations;
      }
      return [...prevLocations, newLocation];
    });
  };

  const removeLocation = (removedLocation: any) => {
    setLocations((prevLocations) => {
      return prevLocations.filter((location) => location.id !== removedLocation.id);
    });
  };

  const handleFindDistances = async () => {
    const distances = Array.from({ length: locations.length }, () =>
      Array.from({ length: locations.length }, () => Infinity)
    );
    for (let i = 0; i < locations.length; i++) {
      for (let j = 0; j < locations.length; j++) {
        const origin = locations[i]['geometry']['coordinates'].join(',');
        const destination = locations[j]['geometry']['coordinates'].join(',');

        const routeData = await calcRouteDirection(origin, destination);
        const distance = routeData.routes[0].distance;
        distances[i][j] = distance / 1000;
        distances[j][i] = distance / 1000;
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

  const addMarker = (location: any) => {
    addLocation(location);

    const id = location.id;
    const long = location.geometry.coordinates[0];
    const lat = location.geometry.coordinates[1];

    map.current!.flyTo({ center: [long, lat], zoom: 13 });

    const marker = new mapboxgl.Marker({ color: '#E0E0E0' })
      .setLngLat([long, lat])
      .addTo(map.current!);
    markers.current[id] = marker;

    setMarkersState(Object.values(markers.current));
  };

  const deleteMarker = (location: any) => {
    const id = location.id;
    const marker = markers.current[id];
    marker.remove();
    delete markers.current[id];
    setMarkersState(Object.values(markers.current));
  };

  const handleRemoveLocation = (locationDetails: any) => {
    removeLocation(locationDetails);
    deleteMarker(locationDetails);
    if (locations.length < 2) {
      setPath([]);
    }
  };

  const handleLocationData = async (locationDetails: any) => {
    addMarker(locationDetails);
  };

  const removeRoutes = (map: mapboxgl.Map | null, routes: any[]) => {
    if (map && routes && routes.length > 0) {
      routes.forEach((_route: any, index: number) => {
        const routeId = 'route' + index;
        if (map.getSource(routeId)) {
          map.removeLayer(routeId);
          map.removeSource(routeId);
        }
      });
    }
  };

  useEffect(() => {
    removeRoutes(map.current, routes);
    if (locations.length > 1) {
      const updateRoutesAsync = async () => {
        let updatedRoutes = [];
        let updatedPath: any[] = [];
        let time = 0;

        if (result.path) {
          for (let i = 0; i < locations.length - 1; i++) {
            const origin = locations[result.path[i]]['geometry']['coordinates'].join(',');
            const destination = locations[result.path[i + 1]]['geometry']['coordinates'].join(',');

            updatedPath.push(locations[result.path[i]]);
            try {
              const routeGeo = await calcRouteDirection(origin, destination);
              const updatedRoute = routeGeo.routes[0].geometry;
              updatedRoutes.push(updatedRoute);
              time += routeGeo.routes[0].duration;
            } catch (error) {
              console.error('Error calculating route direction:', error);
            }
          }
          updatedPath.push(locations[result.path[locations.length - 1]]);
        }

        setDuration(time);
        setRoutes(updatedRoutes);
        setPath(updatedPath);
      };

      updateRoutesAsync();
    }
  }, [locations, result]);

  useEffect(() => {
    if (locations.length > 1) {
      handleFindDistances();
    } else {
      setPath(locations);
      setResult({});
      setDuration(0);
    }
  }, [locations]);

  const getSmoothRoute = (coordinates: [number, number][]): GeoJSON.LineString => {
    return {
      type: 'LineString',
      coordinates: coordinates,
    };
  };
  
  const addRoute = (map: mapboxgl.Map | null, routes: any[]) => {
    if (map && routes && routes.length > 0) {
      routes.forEach((route: any, index: number) => {
        const routeId = 'route' + index;
        const smoothRoute = getSmoothRoute(route.coordinates);
  
        if (map.getSource(routeId)) {
          map.removeLayer(routeId);
          map.removeSource(routeId);
        }
  
        map.addSource(routeId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: smoothRoute,
            properties: {},  // Add this line to include an empty properties object
          },
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
  
  

  const fetchLocation = async (lng: number, lat: number) => {
    try {
      const response = await axios.get(
        `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&access_token=${mapboxgl.accessToken}`
      );
      addMarker(response.data.features[0]);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  useEffect(() => {
    addRoute(map.current, routes);
    console.log('Routes:', routes);
  }, [routes]);

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

      const add_marker = (event: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
        const coordinates = event.lngLat;
        fetchLocation(coordinates.lng, coordinates.lat);
      };

      map.current.on('click', add_marker);
    }
  }, []);

  return (
    <>
      <Sidebar
        sendLocation={handleLocationData}
        updateLocation={handleRemoveLocation}
        results={result}
        path={path}
        time={duration}
      />
      <div ref={mapContainer} className="map-container absolute top-0 left-0 right-0 bottom-0" />
    </>
  );
};

export default Map;
