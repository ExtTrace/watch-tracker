import { ANILIST_API_URL } from "../config/env"

export interface AniListResult {
  id: number;
  title: {
    romaji: string;
    english: string | null;
  };
  nextAiringEpisode: {
    airingAt: number;
    episode: number;
  } | null;
}

export async function searchAniListAnime(query: string): Promise<AniListResult | null> {
  const graphqlQuery = `
    query ($search: String) {
      Media(search: $search, type: ANIME) {
        id
        title {
          romaji
          english
        }
        nextAiringEpisode {
          airingAt
          episode
        }
      }
    }
  `;

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query: graphqlQuery,
      variables: { search: query },
    }),
  };

  try {
    const response = await fetch(ANILIST_API_URL, options);
    if (!response.ok) {
      return null;
    }

    const json = await response.json() as { data?: { Media?: AniListResult } };
    return json?.data?.Media ?? null;
  } catch {
    return null;
  }
}
