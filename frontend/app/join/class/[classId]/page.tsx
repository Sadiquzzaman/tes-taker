import type { Metadata } from "next";
import { headers } from "next/headers";

import AuthLayout from "@/component/Auth/AuthLayout";
import JoinClassModal from "@/component/JoinClass/JoinClassModal";
import getJoinClassById from "@/lib/server/getJoinClassById";

export const dynamic = "force-dynamic";

const DEFAULT_SITE_URL = "http://localhost:3000";
const DEFAULT_OG_IMAGE = "/assets/image/classImage/class_default.png";

const getRequestOrigin = async () => {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const host = forwardedHost || requestHeaders.get("host");

  if (!host) {
    return process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_SITE_URL;
  }

  const protocol = forwardedProto || (host.includes("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
};

export async function generateMetadata({ params }: JoinClassPageProps): Promise<Metadata> {
  const { classId } = await params;
  const { classData } = await getJoinClassById(classId);
  const siteUrl = await getRequestOrigin();
  const pageUrl = `${siteUrl}/join/class/${encodeURIComponent(classId)}`;
  const imageUrl = `${siteUrl}${DEFAULT_OG_IMAGE}`;

  if (!classData) {
    return {
      title: "Join Class | TestTaker",
      description: "Review the class invitation and continue when the class is available.",
      alternates: {
        canonical: pageUrl,
      },
      openGraph: {
        title: "Join Class | TestTaker",
        description: "Review the class invitation and continue when the class is available.",
        url: pageUrl,
        type: "website",
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: "TestTaker class invitation",
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: "Join Class | TestTaker",
        description: "Review the class invitation and continue when the class is available.",
        images: [imageUrl],
      },
    };
  }

  const metadataDescription =
    classData.description || `Join ${classData.class_name} by ${classData.created_user_name}.`;
  const metadataTitle = `${classData.class_name} | Join Class | TestTaker`;

  return {
    title: metadataTitle,
    description: metadataDescription,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: metadataTitle,
      description: metadataDescription,
      url: pageUrl,
      type: "website",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${classData.class_name} class invitation`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: metadataTitle,
      description: metadataDescription,
      images: [imageUrl],
    },
  };
}

export default async function JoinClassPage({ params }: JoinClassPageProps) {
  const { classId } = await params;
  const { classData, apiResponse, errorMessage } = await getJoinClassById(classId);

  return (
    <AuthLayout>
      <JoinClassModal classData={classData} classId={classId} apiResponse={apiResponse} errorMessage={errorMessage} />
    </AuthLayout>
  );
}
