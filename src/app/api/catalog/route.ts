import catalog from "@/data/catalog.json";

// Public catalogue of activities, requests, groups and posts. No auth required.
export function GET() {
  const { OPPS, REQS, GROUPS, POSTS } = catalog;
  return Response.json(
    { opportunities: OPPS, requests: REQS, groups: GROUPS, posts: POSTS, updatedAt: new Date().toISOString() },
    { headers: { "cache-control": "public, max-age=60, s-maxage=300" } },
  );
}
