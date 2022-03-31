import { ArrowRightIcon } from "@heroicons/react/outline";
import { BadgeCheckIcon } from "@heroicons/react/solid";
import { GetServerSidePropsContext } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useState } from "react";
import { Toaster } from "react-hot-toast";
import { JSONObject } from "superjson/dist/types";

import { useLocale } from "@calcom/lib/hooks/useLocale";

import defaultEvents, { getUsernameSlugLink } from "@lib/events/DefaultEvents";
import useTheme from "@lib/hooks/useTheme";
import prisma from "@lib/prisma";
import { inferSSRProps } from "@lib/types/inferSSRProps";

import AvatarGroup from "@components/ui/AvatarGroup";
import { AvatarSSR } from "@components/ui/AvatarSSR";

import { ssrInit } from "@server/lib/ssr";

const EventTypeDescription = dynamic(() => import("@components/eventtype/EventTypeDescription"));
const HeadSeo = dynamic(() => import("@components/seo/head-seo").then((mod) => mod.HeadSeo));
const CryptoSection = dynamic(() => import("../ee/components/web3/CryptoSection"));

interface EvtsToVerify {
  [evtId: string]: boolean;
}

export default function User(props: inferSSRProps<typeof getServerSideProps>) {
  const eventTypes = props.users.length > 1 ? defaultEvents : props.eventTypes;
  const groupEventTypes = (
    <ul className="space-y-3">
      {eventTypes.map((type, index) => (
        <li
          key={index}
          className="hover:border-brand group relative rounded-sm border border-neutral-200 bg-white hover:bg-gray-50 dark:border-0 dark:bg-neutral-900 dark:hover:border-neutral-600">
          <ArrowRightIcon className="absolute right-3 top-3 h-4 w-4 text-black opacity-0 transition-opacity group-hover:opacity-100 dark:text-white" />
          <Link href={getUsernameSlugLink({ users: props.users, slug: type.slug })}>
            <a className="flex justify-between px-6 py-4">
              <div className="flex-shrink">
                <h2 className="font-cal font-semibold text-neutral-900 dark:text-white">{type.title}</h2>
                <EventTypeDescription className="text-sm" eventType={type} />
              </div>
              <div className="mt-1">
                <AvatarGroup
                  border="border-2 border-white"
                  truncateAfter={4}
                  className="flex-shrink-0"
                  size={10}
                  items={props.users.map((user) => ({
                    alt: user.name || "",
                    image: user.avatar || "",
                  }))}
                />
              </div>
            </a>
          </Link>
        </li>
      ))}
    </ul>
  );
  const { Theme } = useTheme(props.users[0].theme);
  const { users } = props;
  const { t } = useLocale();
  const router = useRouter();
  const query = { ...router.query };
  delete query.user; // So it doesn't display in the Link (and make tests fail)
  // TODO:: Create component to pull default group event type from and then get the group availability to fill slots
  const nameOrUsername = users[0].name || users[0].username || "";
  const [evtsToVerify, setEvtsToVerify] = useState<EvtsToVerify>({});
  return (
    <>
      <Theme />
      <HeadSeo
        title={nameOrUsername}
        description={(users[0].bio as string) || ""}
        name={nameOrUsername}
        username={(users[0].username as string) || ""}
        // avatar={user.avatar || undefined}
      />
      <div className="h-screen dark:bg-neutral-900">
        <main className="mx-auto max-w-3xl px-4 py-24">
          {props.users.length < 2 && (
            <div className="mb-8 text-center">
              <AvatarSSR user={users[0]} className="mx-auto mb-4 h-24 w-24" alt={nameOrUsername}></AvatarSSR>
              <h1 className="font-cal mb-1 text-3xl text-neutral-900 dark:text-white">
                {nameOrUsername}
                {users[0].verified && (
                  <BadgeCheckIcon className="mx-1 -mt-1 inline h-6 w-6 text-blue-500 dark:text-white" />
                )}
              </h1>
              <p className="text-neutral-500 dark:text-white">{users[0].bio}</p>
            </div>
          )}
          <div className="space-y-6" data-testid="event-types">
            {users[0].away ? (
              <div className="overflow-hidden rounded-sm border dark:border-gray-900">
                <div className="p-8 text-center text-gray-400 dark:text-white">
                  <h2 className="font-cal mb-2 text-3xl text-gray-600 dark:text-white">
                    😴{" " + t("user_away")}
                  </h2>
                  <p className="mx-auto max-w-md">{t("user_away_description")}</p>
                </div>
              </div>
            ) : props.users.length > 1 ? (
              groupEventTypes
            ) : (
              eventTypes.map((type) => (
                <div
                  key={type.id}
                  style={{ display: "flex" }}
                  className="hover:border-brand group relative rounded-sm border border-neutral-200 bg-white hover:bg-gray-50 dark:border-neutral-700 dark:bg-gray-800 dark:hover:border-neutral-600">
                  <ArrowRightIcon className="absolute right-3 top-3 h-4 w-4 text-black opacity-0 transition-opacity group-hover:opacity-100 dark:text-white" />
                  {/* Don't prefetch till the time we drop the amount of javascript in [user][type] page which is impacting score for [user] page */}
                  <Link
                    prefetch={false}
                    href={{
                      pathname: `/${users[0].username}/${type.slug}`,
                      query,
                    }}>
                    <a
                      onClick={async (e) => {
                        // If a token is required for this event type, add a click listener that checks whether the user verified their wallet or not
                        if (type.metadata.smartContractAddress && !evtsToVerify[type.id]) {
                          const showToast = (await import("@calcom/lib/notification")).default;
                          e.preventDefault();
                          showToast(
                            "You must verify a wallet with a token belonging to the specified smart contract first",
                            "error"
                          );
                        }
                      }}
                      className="block w-full px-6 py-4"
                      data-testid="event-type-link">
                      <h2 className="grow font-semibold text-neutral-900 dark:text-white">{type.title}</h2>
                      <EventTypeDescription eventType={type} />
                    </a>
                  </Link>
                  {type.isWeb3Active && type.metadata.smartContractAddress && (
                    <CryptoSection
                      id={type.id}
                      pathname={`/${users[0].username}/${type.slug}`}
                      smartContractAddress={type.metadata.smartContractAddress as string}
                      verified={evtsToVerify[type.id]}
                      setEvtsToVerify={setEvtsToVerify}
                      oneStep
                    />
                  )}
                </div>
              ))
            )}
          </div>
          {eventTypes.length === 0 && (
            <div className="overflow-hidden rounded-sm border dark:border-gray-900">
              <div className="p-8 text-center text-gray-400 dark:text-white">
                <h2 className="font-cal mb-2 text-3xl text-gray-600 dark:text-white">{t("uh_oh")}</h2>
                <p className="mx-auto max-w-md">{t("no_event_types_have_been_setup")}</p>
              </div>
            </div>
          )}
        </main>
        <Toaster position="bottom-right" />
      </div>
    </>
  );
}

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const ssr = await ssrInit(context);
  const crypto = require("crypto");

  const usernameList = (context.query.user as string).toLowerCase().split("+");
  const dataFetchStart = Date.now();
  const users = await prisma.user.findMany({
    where: {
      username: {
        in: usernameList,
      },
    },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      bio: true,
      avatar: true,
      theme: true,
      plan: true,
      away: true,
      verified: true,
    },
  });

  if (!users.length) {
    return {
      notFound: true,
    };
  }

  const credentials = await prisma.credential.findMany({
    where: {
      userId: {
        in: users.map((user) => user.id),
      },
    },
    select: {
      id: true,
      type: true,
      key: true,
    },
  });

  const web3Credentials = credentials.find((credential) => credential.type.includes("_web3"));

  const eventTypesWithHidden =
    usernameList.length > 1
      ? []
      : await prisma.eventType.findMany({
          where: {
            AND: [
              {
                teamId: null,
              },
              {
                OR: [
                  {
                    userId: users[0].id,
                  },
                  {
                    users: {
                      some: {
                        id: users[0].id,
                      },
                    },
                  },
                ],
              },
            ],
          },
          orderBy: [
            {
              position: "desc",
            },
            {
              id: "asc",
            },
          ],
          select: {
            id: true,
            slug: true,
            title: true,
            length: true,
            description: true,
            hidden: true,
            schedulingType: true,
            price: true,
            currency: true,
            metadata: true,
          },
          take: users[0].plan === "FREE" ? 1 : undefined,
        });
  const dataFetchEnd = Date.now();
  if (context.query.log === "1") {
    context.res.setHeader("X-Data-Fetch-Time", `${dataFetchEnd - dataFetchStart}ms`);
  }
  const eventTypesRaw = eventTypesWithHidden.filter((evt) => !evt.hidden);

  const eventTypes = eventTypesRaw.map((eventType) => ({
    ...eventType,
    metadata: (eventType.metadata || {}) as JSONObject,
    isWeb3Active:
      web3Credentials && web3Credentials.key
        ? (((web3Credentials.key as JSONObject).isWeb3Active || false) as boolean)
        : false,
  }));

  return {
    props: {
      users,
      user: {
        emailMd5: crypto.createHash("md5").update(users[0].email).digest("hex"),
      },
      eventTypes,
      trpcState: ssr.dehydrate(),
    },
  };
};
