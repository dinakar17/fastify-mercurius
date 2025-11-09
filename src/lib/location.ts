/**
 * Helper function to fetch location from IPInfo API
 * @returns Location string in format "city,region,country" or null if fetch fails
 */
export const fetchLocationFromIP = async (): Promise<string | null> => {
  try {
    const token = process.env.IPINFO_TOKEN;
    if (!token) {
      console.warn("IPINFO_TOKEN not set, skipping location fetch");
      return null;
    }

    const response = await fetch(`https://ipinfo.io/json?token=${token}`);
    if (!response.ok) {
      console.error("Failed to fetch location from IPInfo API");
      return null;
    }

    const data = (await response.json()) as {
      city?: string;
      region?: string;
      country?: string;
      ip?: string;
      loc?: string;
      org?: string;
      postal?: string;
      timezone?: string;
    };
    const { city, region, country } = data;

    if (city && region && country) {
      return `${city},${region},${country}`;
    }

    console.warn("Incomplete location data from IPInfo API");
    return null;
  } catch (error) {
    console.error("Error fetching location from IPInfo API:", error);
    return null;
  }
};
