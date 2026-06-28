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

    const { id, title, content } = await request.json();
    
    if (typeof id !== 'number' || !title || !content) {
      return NextResponse.json({ success: false, message: 'Invalid input' }, { status: 400 });
    }

    const updatedCard = await prisma.logisticsCard.update({
      where: { id },
      data: { title, content }
    });

    return NextResponse.json({ success: true, card: updatedCard });
  } catch (error) {
    console.error('Logistics update error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
