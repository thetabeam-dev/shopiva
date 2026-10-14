/**
 * User Signup API Route
 * 
 * Handles user registration for both local and OAuth providers.
 * 
 * @module app/api/user/signup/route
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserModel } from "../../lib/models/user";
import type { NewUserDocument } from "../../lib/types/user";
import { getJwtSecret } from "../../lib/jwt";

const SALT_ROUNDS = 10;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      fname,
      lname,
      email,
      phone,
      password,
      gender,
      role = "customer",
      src = "web",
      deviceId = "null",
      deviceToken = "null",
      provider = "local",
      whatsappMarketingConsent = false,
    } = body;

    // Handle OAuth providers (Google, Apple, Facebook)
    if (provider !== "local") {
      const user = await UserModel.findOrCreateOAuthUser({
        email,
        fname: fname || email.split("@")[0],
        lname: lname || "",
        provider,
        role,
        whatsappMarketingConsent: whatsappMarketingConsent === true,
      });

      if (!user) {
        return NextResponse.json(
          { bool: false, data: { mssg: "Failed to create user" } },
          { status: 400 }
        );
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email },
        getJwtSecret(),
        { expiresIn: "7d" }
      );

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      return NextResponse.json({
        bool: true,
        message: "User created successfully",
        cookie: token,
        user: userWithoutPassword,
      });
    }

    // Local registration
    // Check if user exists with deleted account
    const existingUsers = await UserModel.findUserByEmail(email);
    
    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      
      if (existingUser.accountStatus === "deleted") {
        // Reactivate deleted account
        await UserModel.recreateProfile({ id: existingUser.id });
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        await UserModel.updatePassword({ id: existingUser.id, password: hashedPassword });
        
        const updatedUsers = await UserModel.findUserById(existingUser.id);
        const { password: _, ...userWithoutPassword } = updatedUsers[0];

        const token = jwt.sign(
          { id: existingUser.id, email: updatedUsers[0].email },
          getJwtSecret(),
          { expiresIn: "7d" }
        );

        return NextResponse.json({
          bool: true,
          message: "Account reactivated successfully",
          cookie: token,
          user: userWithoutPassword,
        });
      }

      return NextResponse.json(
        { bool: false, data: { mssg: "email exists" } },
        { status: 400 }
      );
    }

    // Check if phone already exists
    if (phone && phone !== "null") {
      const phoneExists = await UserModel.countPhone(phone);
      if (phoneExists > 0) {
        return NextResponse.json(
          { bool: false, data: { mssg: "phone exists" } },
          { status: 400 }
        );
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const user = await UserModel.createUserDoc({
      fname,
      lname,
      email,
      phone: phone || null,
      password: hashedPassword,
      gender: gender || null,
      role,
      provider: "local",
      src,
      deviceId,
      deviceToken,
      whatsappMarketingConsent: whatsappMarketingConsent === true,
    });

    if (!user) {
      return NextResponse.json(
        { bool: false, data: { mssg: "Failed to create user" } },
        { status: 400 }
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({
      bool: true,
      message: "User created successfully",
      cookie: token,
      user: userWithoutPassword,
    });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { bool: false, data: { mssg: err instanceof Error ? err.message : "An error occurred" } },
      { status: 500 }
    );
  }
}

