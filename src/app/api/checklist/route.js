import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';

async function checkAuth() {
  const cookieStore = await cookies();
  return cookieStore.get('admin_authenticated')?.value === 'true';
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    // 1. Create a new checklist item (requires admin authentication)
    if (body.tripId && body.text && body.category && !body.id) {
      if (!await checkAuth()) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }

      const newItem = await prisma.checklistItem.create({
        data: {
          tripId: body.tripId,
          text: body.text,
          category: body.category,
          isCompleted: false
        }
      });
      return NextResponse.json({ success: true, item: newItem });
    }

    // 2. Update an existing item (requires admin auth only if editing text)
    const { id, isCompleted, text } = body;
    if (typeof id !== 'number') {
      return NextResponse.json({ success: false, message: 'Invalid input' }, { status: 400 });
    }

    const updateData = {};
    if (typeof isCompleted === 'boolean') {
      updateData.isCompleted = isCompleted;
    }
    
    if (typeof text === 'string') {
      if (!await checkAuth()) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }
      updateData.text = text;
    }

    const updatedItem = await prisma.checklistItem.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ success: true, item: updatedItem });
  } catch (error) {
    console.error('Checklist update/create error:', error);
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

    await prisma.checklistItem.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Checklist delete error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
