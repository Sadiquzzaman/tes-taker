import type { Metadata } from "next";
import { headers } from "next/headers";

import AuthLayout from "@/component/Auth/AuthLayout";
import JoinTestModal from "@/component/JoinTest/JoinTestModal";
import getJoinTestById from "@/lib/server/getJoinTestById";

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

export async function generateMetadata({ params }: JoinTestPageProps): Promise<Metadata> {
  const { testId } = await params;
  const { testData } = await getJoinTestById(testId);
  console.log({ testData });
  const siteUrl = await getRequestOrigin();
  const pageUrl = `${siteUrl}/join/test/${encodeURIComponent(testId)}`;
  const imageUrl = `${siteUrl}${DEFAULT_OG_IMAGE}`;

  if (!testData) {
    return {
      title: "Test Invitation | TestTaker",
      description: "Review the test invitation and continue when the test is available.",
      alternates: {
        canonical: pageUrl,
      },
      openGraph: {
        title: "Test Invitation | TestTaker",
        description: "Review the test invitation and continue when the test is available.",
        url: pageUrl,
        type: "website",
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: "TestTaker test invitation",
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: "Test Invitation | TestTaker",
        description: "Review the test invitation and continue when the test is available.",
        images: [imageUrl],
      },
    };
  }

  const metadataDescription = `Join ${testData.test_name} by ${testData.created_user_name}.`;
  const metadataTitle = `${testData.test_name} | Test Invitation | TestTaker`;

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
          alt: `${testData.test_name} test invitation`,
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

export default async function JoinTestPage({ params }: JoinTestPageProps) {
  const { testId } = await params;
  const { testData, apiResponse, errorMessage } = await getJoinTestById(testId);

  return (
    <AuthLayout>
      <JoinTestModal testData={testData} testId={testId} apiResponse={apiResponse} errorMessage={errorMessage} />
    </AuthLayout>
  );
}
