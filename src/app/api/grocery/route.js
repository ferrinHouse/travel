import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(request) {
  try {
    const { id, isBought } = await request.json();
    
    if (typeof id !== 'number' || typeof isBought !== 'boolean') {
      return NextResponse.json({ success: false, message: 'Invalid input' }, { status: 400 });
    }

    const updatedItem = await prisma.groceryItem.update({
      where: { id },
      data: { isBought }
    });

    return NextResponse.json({ success: true, item: updatedItem });
  } catch (error) {
    console.error('Grocery update error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { tripId, name, category } = await request.json();

    if (!tripId || !name || !category) {
      return NextResponse.json({ success: false, message: 'Missing fields' }, { status: 400 });
    }

    const newItem = await prisma.groceryItem.create({
      data: { tripId, name, category }
    });

    return NextResponse.json({ success: true, item: newItem });
  } catch (error) {
    console.error('Grocery creation error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
