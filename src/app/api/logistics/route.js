import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { isAdminRequest, unauthorized } from '@/lib/auth/legacy';

export async function POST(request) {
  try {
    if (!await isAdminRequest()) {
      return unauthorized();
    }

    const { id, tripId, title, content } = await request.json();
    
    // 1. Create a new Logistics Card
    if (!id) {
      if (!tripId || !title || !content) {
        return NextResponse.json({ success: false, message: 'Invalid input' }, { status: 400 });
      }
      
      // Calculate order for new card to append it to the end
      const lastCard = await prisma.logisticsCard.findFirst({
        where: { tripId },
        orderBy: { order: 'desc' }
      });
      const order = lastCard ? lastCard.order + 1 : 0;

      const newCard = await prisma.logisticsCard.create({
        data: { tripId, title, content, order }
      });

      return NextResponse.json({ success: true, card: newCard });
    }
    
    // 2. Update an existing Logistics Card
    if (typeof id !== 'number' || !title || !content) {
      return NextResponse.json({ success: false, message: 'Invalid input' }, { status: 400 });
    }

    const updatedCard = await prisma.logisticsCard.update({
      where: { id },
      data: { title, content }
    });

    return NextResponse.json({ success: true, card: updatedCard });
  } catch (error) {
    console.error('Logistics update/create error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    if (!await isAdminRequest()) {
      return unauthorized();
    }

    const { id } = await request.json();
    if (typeof id !== 'number') {
      return NextResponse.json({ success: false, message: 'Invalid input' }, { status: 400 });
    }

    await prisma.logisticsCard.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logistics delete error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
