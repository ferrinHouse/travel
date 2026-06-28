import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(request) {
  try {
    const { id, isCompleted } = await request.json();
    
    if (typeof id !== 'number' || typeof isCompleted !== 'boolean') {
      return NextResponse.json({ success: false, message: 'Invalid input' }, { status: 400 });
    }

    const updatedItem = await prisma.checklistItem.update({
      where: { id },
      data: { isCompleted }
    });

    return NextResponse.json({ success: true, item: updatedItem });
  } catch (error) {
    console.error('Checklist update error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
