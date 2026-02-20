import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureBlogPostsTable, getDb } from "@/lib/db";

export const runtime = "nodejs";

const createBlogPostSchema = z.object({
  title: z.string().trim().min(1).max(200),
  date: z.iso.date(),
  author: z.string().trim().min(1).max(100),
  text: z.string().trim().min(1).max(10000),
});

type BlogPostRow = {
  id: number;
  title: string;
  post_date: string;
  author: string;
  text: string;
  created_at: string;
};

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createBlogPostSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  await ensureBlogPostsTable();

  const db = getDb();

  const insertResult = db
    .prepare(
      `
      INSERT INTO blog_posts (
        title,
        post_date,
        author,
        text
      )
      VALUES (?, ?, ?, ?);
    `,
    )
    .run(
      parsed.data.title,
      parsed.data.date,
      parsed.data.author,
      parsed.data.text,
    );

  const blogPost = db
    .prepare(
      `
      SELECT
        id,
        title,
        post_date,
        author,
        text,
        created_at
      FROM blog_posts
      WHERE id = ?;
    `,
    )
    .get(insertResult.lastInsertRowid as number) as BlogPostRow | undefined;

  if (!blogPost) {
    return NextResponse.json(
      {
        error: "Failed to create blog post",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      blogPost: {
        id: blogPost.id,
        title: blogPost.title,
        date: blogPost.post_date,
        author: blogPost.author,
        text: blogPost.text,
        createdAt: blogPost.created_at,
      },
    },
    { status: 201 },
  );
}
