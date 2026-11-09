import { cache } from 'react';
import prisma from '@/lib/db';
import { PHOTO_ORDER } from '@/lib/photos/client-photo';

/** Everything the story shows (and nothing else): days, plans and photos. One query per request. */
export const loadStory = cache((id) =>
  prisma.trip.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      dates: true,
      travelers: true,
      tag: true,
      primaryColor: true,
      accentColor: true,
      days: {
        orderBy: { dayNumber: 'asc' },
        select: {
          id: true,
          dayNumber: true,
          dateLabel: true,
          title: true,
          activities: { orderBy: { order: 'asc' }, select: { id: true, time: true, description: true } },
        },
      },
      photos: {
        orderBy: PHOTO_ORDER,
        select: { id: true, dayNumber: true, caption: true, width: true, height: true, isCover: true },
      },
    },
  })
);
