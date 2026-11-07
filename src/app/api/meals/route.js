import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { isAdminRequest, unauthorized } from '@/lib/auth/legacy';

export async function POST(request) {
  try {
    if (!await isAdminRequest()) {
      return unauthorized();
    }

    const { tripId, dayNumber, mealType, mealName, details, time } = await request.json();

    if (!tripId || typeof dayNumber !== 'number' || !mealType) {
      return NextResponse.json({ success: false, message: 'Invalid input' }, { status: 400 });
    }

    const existingPlan = await prisma.mealPlan.findFirst({
      where: { tripId, dayNumber, mealType }
    });

    // An empty meal name means "not planned": remove the record.
    const name = typeof mealName === 'string' ? mealName.trim() : '';
    if (!name) {
      if (existingPlan) {
        await prisma.mealPlan.delete({ where: { id: existingPlan.id } });
      }
      return NextResponse.json({ success: true, deleted: true });
    }

    let updatedMeal;
    if (existingPlan) {
      updatedMeal = await prisma.mealPlan.update({
        where: { id: existingPlan.id },
        data: { mealName: name, details, time }
      });
    } else {
      updatedMeal = await prisma.mealPlan.create({
        data: { tripId, dayNumber, mealType, mealName: name, details, time }
      });
    }

    return NextResponse.json({ success: true, meal: updatedMeal });
  } catch (error) {
    console.error('Meal update error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
