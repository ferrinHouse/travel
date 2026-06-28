import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';

async function checkAuth() {
  const cookieStore = await cookies();
  return cookieStore.get('admin_authenticated')?.value === 'true';
}

export async function POST(request) {
  try {
    if (!await checkAuth()) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id, time, description, details, isAlert } = await request.json();
    
    if (typeof id !== 'number' || !description) {
      return NextResponse.json({ success: false, message: 'Invalid input' }, { status: 400 });
    }

    const updatedActivity = await prisma.itineraryActivity.update({
      where: { id },
      data: { time, description, details, isAlert: !!isAlert }
    });

    return NextResponse.json({ success: true, activity: updatedActivity });
  } catch (error) {
    console.error('Activity update error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    if (!await checkAuth()) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { dayId, time, description, details, isAlert } = await request.json();

    if (typeof dayId !== 'number' || !description) {
      return NextResponse.json({ success: false, message: 'Invalid input' }, { status: 400 });
    }

    // Get max order
    const maxOrderActivity = await prisma.itineraryActivity.findFirst({
      where: { dayId },
      orderBy: { order: 'desc' }
    });
    const order = maxOrderActivity ? maxOrderActivity.order + 1 : 0;

    const newActivity = await prisma.itineraryActivity.create({
      data: { dayId, time, description, details, isAlert: !!isAlert, order }
    });

    return NextResponse.json({ success: true, activity: newActivity });
  } catch (error) {
    console.error('Activity creation error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    if (!await checkAuth()) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await request.json();

    if (typeof id !== 'number') {
      return NextResponse.json({ success: false, message: 'Invalid input' }, { status: 400 });
    }

    await prisma.itineraryActivity.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Activity deletion error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
