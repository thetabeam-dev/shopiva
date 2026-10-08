import type { Request, Response } from "express";
import { SignupService, SigninService, UpdateProfileService, UpdateEmailService, UpdatePhoneService, UpdatePhotoService, UpdatePasswordService, DeleteUserService, UpdateRoleService } from "../services/user.js";
import {
    RequestPasswordResetPinService,
    ResetPasswordWithPinService,
    VerifyPasswordResetPinService,
} from "../services/passwordRecovery.js";
import type { AuthRequest } from "../middleware/auth.js";
import {
    appRoleToNotificationRole,
    listNotifications,
    markNotificationRead,
} from "../services/notifications.js";

export async function SignupController(req: Request, res: Response) {
    try {
        const { fname, lname, email, phone, provider, password, gender, role, src, deviceId, deviceToken } = req.body;
        
        const result = await SignupService({ fname, lname, email, phone, provider, password, gender, role, src, deviceId, deviceToken });
        
        res.status(201).json({
            message: "User created successfully",
            token: result.token,
            user: result.user
        });
    } catch (err) {
        res.status(400).json({
            error: err instanceof Error ? err.message : String(err)
        });
    }
}

function recoveryStatus(err: unknown): number {
    const status = err && typeof err === "object" && "status" in err ? Number((err as { status?: number }).status) : 400;
    return Number.isFinite(status) ? status : 400;
}

export async function ForgotPasswordController(req: Request, res: Response) {
    try {
        const result = await RequestPasswordResetPinService(req.body?.email);
        res.status(200).json({ ...result, message: "A PIN was sent to that email." });
    } catch (err) {
        res.status(recoveryStatus(err)).json({
            success: false,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

export async function VerifyPasswordPinController(req: Request, res: Response) {
    try {
        const result = await VerifyPasswordResetPinService(req.body?.email, req.body?.pin);
        res.status(200).json(result);
    } catch (err) {
        res.status(recoveryStatus(err)).json({
            success: false,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

export async function ResetPasswordController(req: Request, res: Response) {
    try {
        const result = await ResetPasswordWithPinService(
            req.body?.email,
            req.body?.resetToken,
            req.body?.newPassword,
        );
        res.status(200).json({ ...result, message: "Password updated." });
    } catch (err) {
        res.status(recoveryStatus(err)).json({
            success: false,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

export async function SigninController(req: Request, res: Response) {
    try {
        const { email, password, fcmToken } = req.body;
        
        const result = await SigninService({ email, password, fcmToken });
        
        res.status(200).json({
            message: "Login successful",
            token: result.token,
            user: result.user
        });
    } catch (err) {
        res.status(401).json({
            error: err instanceof Error ? err.message : String(err)
        });
    }
}

export async function DeleteUserController(req: Request, res: Response) {
    try {
        if (!req.params?.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const authReq = req as AuthRequest;
        if (Number(authReq.user?.id) !== Number(req.params.id)) {
            res.status(403).json({ error: "Forbidden" });
            return;
        }

        await DeleteUserService(Number(req.params.id), {
            password: req.body?.password,
            oauthProvider: req.body?.oauthProvider,
            oauthReauthenticated: req.body?.oauthReauthenticated,
            oauthReauthenticatedAt: req.body?.oauthReauthenticatedAt,
            oauthReauthToken: req.body?.oauthReauthToken,
        });
        
        res.status(200).json({
            success: true,
            message: "Account deleted successfully."
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes("invalid password")) {
            res.status(403).json({ error: message });
            return;
        }
        if (message.toLowerCase().includes("required") || message.toLowerCase().includes("reauth")) {
            res.status(422).json({ error: message });
            return;
        }
        if (message.toLowerCase().includes("not found")) {
            res.status(404).json({ error: message });
            return;
        }
        res.status(500).json({ error: message });
    }
}

export async function DeleteMyAccountController(req: AuthRequest, res: Response) {
    try {
        const userId = Number(req.user?.id);
        if (!Number.isFinite(userId) || userId <= 0) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        await DeleteUserService(userId, {
            password: req.body?.password,
            oauthProvider: req.body?.oauthProvider,
            oauthReauthenticated: req.body?.oauthReauthenticated,
            oauthReauthenticatedAt: req.body?.oauthReauthenticatedAt,
            oauthReauthToken: req.body?.oauthReauthToken,
        });

        res.status(200).json({
            success: true,
            message: "Account deleted successfully."
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes("invalid password")) {
            res.status(403).json({ error: message });
            return;
        }
        if (message.toLowerCase().includes("required") || message.toLowerCase().includes("reauth")) {
            res.status(422).json({ error: message });
            return;
        }
        if (message.toLowerCase().includes("not found")) {
            res.status(404).json({ error: message });
            return;
        }
        res.status(500).json({ error: message });
    }
}

export async function UpdateEmailController(req: Request, res: Response) {
    try {
        if (!req.params?.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const { email } = req.body;
        const result = await UpdateEmailService(req.params.id as unknown as number, email);
        
        res.status(200).json({
            message: "Email updated successfully",
            user: result
        });
    } catch (err) {
        res.status(400).json({
            error: err instanceof Error ? err.message : String(err)
        });
    }
}

export async function UpdateRoleController(req: Request, res: Response) {
    try {
        if (!req.params?.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const { role } = req.body;
        const result = await UpdateRoleService(req.params.id as unknown as number, role);
        
        res.status(200).json({
            message: "Role updated successfully",
            user: result
        });
    } catch (err) {
        res.status(400).json({
            error: err instanceof Error ? err.message : String(err)
        });
    }
}

export async function UpdatePhoneController(req: Request, res: Response) {
    try {
        if (!req.params?.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const { phone } = req.body;
        const result = await UpdatePhoneService(req.params.id as unknown as number, phone);
        
        res.status(200).json({
            message: "Phone updated successfully",
            user: result
        });
    } catch (err) {
        console.log(err)
        res.status(400).json({
            error: err instanceof Error ? err.message : String(err)
        });
    }
}

export async function UpdatePhotoController(req: Request, res: Response) {
    try {
        if (!req.params?.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const { photo } = req.body;
        const result = await UpdatePhotoService(req.params.id as unknown as number, photo);
        
        res.status(200).json({
            message: "Photo updated successfully",
            user: result
        });
    } catch (err) {
        res.status(400).json({
            error: err instanceof Error ? err.message : String(err)
        });
    }
}

export async function UpdateProfileController(req: Request, res: Response) {
    try {
        if (!req.params?.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const { fname, lname, gender, preferredLanguage, timezone, location } = req.body;
        const result = await UpdateProfileService(req.params.id as unknown as number, {
            fname,
            lname,
            gender,
            preferredLanguage,
            timezone,
            ...(location != null &&
            typeof location === "object" &&
            !Array.isArray(location)
                ? { location: location as Record<string, unknown> }
                : {}),
        });
        
        res.status(200).json({
            message: "Profile updated successfully",
            user: result
        });
    } catch (err) {
        res.status(400).json({
            error: err instanceof Error ? err.message : String(err)
        });
    }
}

export async function UpdatePasswordController(req: Request, res: Response) {
    try {
        if (!req.params?.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const { password } = req.body;
        const result = await UpdatePasswordService(req.params.id as unknown as number, password);
        
        res.status(200).json({
            message: "Password updated successfully"
        });
    } catch (err) {
        res.status(400).json({
            error: err instanceof Error ? err.message : String(err)
        });
    }
}

export async function ListNotificationsController(req: Request, res: Response) {
    try {
        const user = (req as AuthRequest).user;
        const userId = Number(user?.id);
        const role = appRoleToNotificationRole(req.query.role);
        if (!Number.isFinite(userId) || userId <= 0) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        if (!role) {
            res.status(400).json({ error: "role must be buyer or vendor" });
            return;
        }
        const notifications = await listNotifications(userId, role);
        res.status(200).json({ notifications });
    } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
}

export async function MarkNotificationReadController(req: Request, res: Response) {
    try {
        const user = (req as AuthRequest).user;
        const userId = Number(user?.id);
        const notificationId = Number(req.params.id);
        if (!Number.isFinite(userId) || userId <= 0) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        if (!Number.isFinite(notificationId)) {
            res.status(400).json({ error: "Invalid notification id" });
            return;
        }
        const notification = await markNotificationRead(userId, notificationId);
        if (!notification) {
            res.status(404).json({ error: "Notification not found" });
            return;
        }
        res.status(200).json({ notification });
    } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
}
