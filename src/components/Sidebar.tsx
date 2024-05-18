import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Sidebar = ({ sendLocation , updateLocation, selectLocData }) => {
    const [searchInput, setSearchInput] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [selectedLocations, setSelectedLocations] = useState([]);

    const addLocation = (newLocation) => {
        setSelectedLocations((prevLocations) => {
          // Check if the newLocation ID already exists in the current array
          if (prevLocations.some(location => location.id === newLocation.id)) 
          {
            return prevLocations; // Return the existing array if ID is already present
          }
          return [...prevLocations, newLocation]; // Add newLocation if ID is unique
        });
      };

    useEffect(() => {
        const fetchSuggestions = async () => {
            try {
                const response = await axios.get(`https://api.mapbox.com/search/geocode/v6/forward?q=${searchInput}&access_token=pk.eyJ1IjoibWFzaGJ1cm4iLCJhIjoiY2x3MnVlcWZmMGtpeTJxbzA5ZXNmb3V0MCJ9.E-W6jVgrBjtiZL-mUJhUAw`);
                setSuggestions(response.data.features);
            } catch (error) {
                console.error('Error fetching suggestions:', error);
            }
        };

        // Fetch suggestions only if there is a search input
        if (searchInput) { 
            fetchSuggestions();
        } else {
            // Clear suggestions when search input is empty twice
            setSuggestions([]);

            
        }
    }, [searchInput]);
    
    useEffect(() => {
        // Call handlelocationData whenever selectLocData changes
        if (selectLocData) {
            setSelectedLocations(selectLocData);
        }
    }, [selectLocData]); 
    
    const handleInputChange = (event: { target: { value: React.SetStateAction<string>; }; }) => {
        setSearchInput(event.target.value);
    };

    const handleSuggestionClick = (suggestion: never) => {
        if (suggestion.geometry && suggestion.properties && suggestion.properties.name) {
            //setSelectedLocations([...selectedLocations, suggestion]);
            addLocation(suggestion);
            sendLocation(suggestion);
            setSearchInput('');
            setSuggestions([]);
        } else {
            console.error('Error: Unexpected response data');
        }
    };

    const handleKeyDown = (event: { key: string; }) => {
        if (event.key === 'Enter') {
            handleSuggestionClick(suggestions[0]);
        }
    };

    const handleRemoveLocation = (locationToRemove: never) => {
        setSelectedLocations(prevLocations => prevLocations.filter(location => location !== locationToRemove));
        updateLocation(locationToRemove);
    };

    return (
        <div className="absolute top-5 left-5 rounded-xl z-10 container w-72 bg-gray-300 shadow-sm flex flex-col items-center grid justify-center">
            <input
                type="text"
                className="rounded-t-xl w-72 pt-2 pl-12 border bg-gray-300 focus:bg-gray-300 focus:outline-none border-transparent"
                placeholder="search..."
                value={searchInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
            />
            <svg className="pl-4 w-10 h-8 absolute left-0 top-1.5 right-1.5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l5 5M10 14a4 4 0 100-8 4 4 0 000 8z" />
</svg>


            <div className='bg-gray-300 border-t-0 rounded-b-3xl w-72 h-2'></div>

            
            {suggestions.length > 0 && searchInput && (
                <>
                <ul className=" space-y-0.5 asbolute bg-white border border-gray-300 w-full mt-0 rounded-2xl ">
                    {suggestions.map((suggestion) => (
                        <li key={suggestion.id} className="mt-2 mb-2 py-1 border-b-0 relative cursor-pointer hover:bg-gray-50 hover:text-gray-900 hover:rounded-xl" onClick={() => handleSuggestionClick(suggestion)}>
                            <p className="text-left pl-4 pt-2 pb-1 text-sm text-gray-900 font-medium">{suggestion.properties.name}</p>
                            <p className="text-left pl-4 pb-2 text-sm text-gray-500">{suggestion.properties.place_formatted}</p>
                        </li>
                    ))}
                </ul>{selectedLocations.length > 0 &&(
                    <p className="text-left pl-4 pt-2 pb-1 text-sm text-gray-900 font-medium roundedt-t-xl">selected</p>
                )}
                </>
                
            )}

            {selectedLocations.length > 0 && (
                
                <ul className="bg-white w-full mt-0 rounded-xl">
{/* Suggested code may be subject to a license. Learn more: ~LicenseLog:2722730320. */}
                    {selectedLocations.map((location) => (
                        <li key={location.id} className="mt-2 mb-2 py-1 relative cursor-pointer hover:bg-gray-50 hover:text-gray-900 rounded-xl">
                            <p className="text-left pl-4 pt-2 pb-1 text-sm text-gray-900 font-medium roundedt-t-xl">{location.properties.name}</p>
                            {/* Adjust this line according to your data structure */}
                            <p className="text-left pl-4 pb-2 text-sm text-gray-500">{location.properties.place_formatted}</p>
                            <button onClick={() => handleRemoveLocation(location)} className="absolute top-0 right-0 mr-2 mt-2 w-6 h-6 flex justify-center items-center text-sm text-gray-500 hover:text-red-600 focus:outline-none border-0 bg-gray-200 rounded-md pt-0 pb-1 pr-2 pl-2">
                            <svg className="w-4 h-4 absolute top-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

        </div>
    );
};

export default Sidebar;