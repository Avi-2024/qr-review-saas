import { describe, expect, it, vi } from "vitest";
import { GooglePlacesClient } from "@/server/integrations/google-places/google-places-client";

const API_KEY = "test-google-places-api-key-123456789";
const SESSION_TOKEN = "11111111-1111-4111-8111-111111111111";

describe("GooglePlacesClient", () => {
  it("uses Places API New autocomplete with a session token and narrow field mask", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      suggestions: [
        {
          placePrediction: {
            placeId: "ChIJ-test-place",
            text: { text: "Royal Cafe, Vijay Nagar, Indore, India" },
            structuredFormat: {
              mainText: { text: "Royal Cafe" },
              secondaryText: { text: "Vijay Nagar, Indore, India" },
            },
          },
        },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const client = new GooglePlacesClient(API_KEY, 4_000, fetchMock as typeof fetch);
    const predictions = await client.autocomplete("Royal Cafe Indore", SESSION_TOKEN);

    expect(predictions).toEqual([{
      placeId: "ChIJ-test-place",
      mainText: "Royal Cafe",
      secondaryText: "Vijay Nagar, Indore, India",
      fullText: "Royal Cafe, Vijay Nagar, Indore, India",
    }]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://places.googleapis.com/v1/places:autocomplete");
    expect(init.method).toBe("POST");
    expect(init.headers["X-Goog-Api-Key"]).toBe(API_KEY);
    expect(init.headers["X-Goog-FieldMask"]).toContain("suggestions.placePrediction.placeId");
    expect(JSON.parse(init.body)).toEqual({
      input: "Royal Cafe Indore",
      sessionToken: SESSION_TOKEN,
      includeQueryPredictions: false,
    });
  });

  it("finishes the autocomplete session with Place Details using the same token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "ChIJ-test-place",
      displayName: { text: "Royal Cafe" },
      formattedAddress: "Vijay Nagar, Indore, Madhya Pradesh, India",
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const client = new GooglePlacesClient(API_KEY, 4_000, fetchMock as typeof fetch);
    const place = await client.details("ChIJ-test-place", SESSION_TOKEN);

    expect(place).toEqual({
      placeId: "ChIJ-test-place",
      displayName: "Royal Cafe",
      formattedAddress: "Vijay Nagar, Indore, Madhya Pradesh, India",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("https://places.googleapis.com/v1/places/ChIJ-test-place");
    expect(url).toContain(`sessionToken=${SESSION_TOKEN}`);
    expect(init.headers["X-Goog-FieldMask"]).toBe("id,displayName,formattedAddress");
  });

  it("does not call Google for an autocomplete query shorter than two characters", async () => {
    const fetchMock = vi.fn();
    const client = new GooglePlacesClient(API_KEY, 4_000, fetchMock as typeof fetch);

    await expect(client.autocomplete("R", SESSION_TOKEN)).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("converts an upstream quota response into a temporary service error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 429 }));
    const client = new GooglePlacesClient(API_KEY, 4_000, fetchMock as typeof fetch);

    await expect(client.autocomplete("Royal Cafe", SESSION_TOKEN)).rejects.toMatchObject({
      code: "GOOGLE_PLACES_UPSTREAM_ERROR",
      statusCode: 503,
    });
  });
});
