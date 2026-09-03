import { AppError, ValidationError } from "@/server/core/errors";

export interface GooglePlacePrediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
}

export interface GooglePlaceDetails {
  placeId: string;
  displayName: string;
  formattedAddress: string;
}

type FetchLike = typeof fetch;

type AutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
};

type PlaceDetailsResponse = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
};

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const PLACE_DETAILS_BASE_URL = "https://places.googleapis.com/v1/places";

export class GooglePlacesClient {
  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs = 4_000,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async autocomplete(input: string, sessionToken: string): Promise<GooglePlacePrediction[]> {
    const query = input.trim();
    if (query.length < 2) return [];

    const response = await this.request(AUTOCOMPLETE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": [
          "suggestions.placePrediction.placeId",
          "suggestions.placePrediction.text.text",
          "suggestions.placePrediction.structuredFormat.mainText.text",
          "suggestions.placePrediction.structuredFormat.secondaryText.text",
        ].join(","),
      },
      body: JSON.stringify({
        input: query,
        sessionToken,
        includeQueryPredictions: false,
      }),
    });

    const body = (await response.json()) as AutocompleteResponse;
    return (body.suggestions ?? [])
      .map((suggestion): GooglePlacePrediction | null => {
        const prediction = suggestion.placePrediction;
        const placeId = prediction?.placeId?.trim();
        if (!placeId) return null;

        const mainText = prediction?.structuredFormat?.mainText?.text?.trim() || prediction?.text?.text?.trim() || "Google business";
        const secondaryText = prediction?.structuredFormat?.secondaryText?.text?.trim() || "";
        const fullText = prediction?.text?.text?.trim() || [mainText, secondaryText].filter(Boolean).join(", ");
        return { placeId, mainText, secondaryText, fullText };
      })
      .filter((prediction): prediction is GooglePlacePrediction => Boolean(prediction))
      .slice(0, 5);
  }

  async details(placeId: string, sessionToken: string): Promise<GooglePlaceDetails> {
    const normalizedPlaceId = placeId.trim();
    if (!normalizedPlaceId) throw new ValidationError("A Google Place ID is required.");

    const url = `${PLACE_DETAILS_BASE_URL}/${encodeURIComponent(normalizedPlaceId)}?sessionToken=${encodeURIComponent(sessionToken)}`;
    const response = await this.request(url, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": "id,displayName,formattedAddress",
      },
    });

    const body = (await response.json()) as PlaceDetailsResponse;
    if (!body.id) {
      throw new AppError("The selected Google business could not be verified.", 502, "GOOGLE_PLACE_INVALID_RESPONSE");
    }

    return {
      placeId: body.id,
      displayName: body.displayName?.text?.trim() || "Selected Google business",
      formattedAddress: body.formattedAddress?.trim() || "",
    };
  }

  private async request(url: string, init: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        const statusCode = response.status === 404 ? 400 : response.status === 429 ? 503 : 502;
        const code = response.status === 404 ? "GOOGLE_PLACE_NOT_FOUND" : "GOOGLE_PLACES_UPSTREAM_ERROR";
        const message = response.status === 404
          ? "The selected Google business could not be found."
          : "Google business search is temporarily unavailable. Please try again.";
        throw new AppError(message, statusCode, code);
      }
      return response;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError("Google business search timed out. Please try again.", 504, "GOOGLE_PLACES_TIMEOUT");
      }
      throw new AppError("Google business search is temporarily unavailable. Please try again.", 502, "GOOGLE_PLACES_UNAVAILABLE");
    } finally {
      clearTimeout(timeout);
    }
  }
}
