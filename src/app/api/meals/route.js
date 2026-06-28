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

    const { tripId, dayNumber, mealType, mealName, details, time } = await request.json();

    if (!tripId || typeof dayNumber !== 'number' || !mealType || !mealName) {
      return NextResponse.json({ success: false, message: 'Invalid input' }, { status: 400 });
    }

    // Upsert the meal plan record
    const existingPlan = await prisma.mealPlan.findFirst({
      where: { tripId, dayNumber, mealType }
    });

    let updatedMeal;
    if (existingPlan) {
      updatedMeal = await prisma.mealPlan.update({
        where: { id: existingPlan.id },
        data: { mealName, details, time }
      });
    } else {
      updatedMeal = await prisma.mealPlan.create({
        data: { tripId, dayNumber, mealType, mealName, details, time }
      });
    }

    return NextResponse.json({ success: true, meal: updatedMeal });
  } catch (error) {
    console.error('Meal update error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
