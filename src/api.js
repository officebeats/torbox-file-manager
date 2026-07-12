export const fetchTorrents = async (apiKey) => {
  try {
    const response = await fetch('https://api.torbox.app/v1/api/torrents/mylist', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`TorBox API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching torrents:', error);
    throw error;
  }
};
