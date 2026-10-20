import express from "express";
import { authenticate, authenticateUser, verifyToken, type AuthRequest } from "../middleware/auth.js";
import { DeleteMyAccountController, DeleteUserController, ForgotPasswordController, ResetPasswordController, SigninController, SignupController, UpdateEmailController, UpdatePasswordController, UpdatePhoneController, UpdatePhotoController, UpdateProfileController, UpdateRoleController, VerifyPasswordPinController, ListNotificationsController, MarkNotificationReadController, GetWalletController, GetWalletRecipientController, ListWalletTransactionsController, SendWalletController, WithdrawWalletController, CreateWalletPinController, VerifyWalletPinController, ChangeWalletPinController, RequestWalletPinResetController, VerifyWalletPinResetController, ResetWalletPinController } from "../controllers/user.js";
import { UploadUserPhotoController, userPhotoUploadMiddleware } from "../controllers/userPhotoUpload.js";

export const UserRouter = express.Router();

// Public routes (no middleware)
UserRouter.post("/user/signup", SignupController);
UserRouter.post("/user/signin", SigninController);
UserRouter.post("/user/password/forgot", ForgotPasswordController);
UserRouter.post("/user/password/verify-pin", VerifyPasswordPinController);
UserRouter.post("/user/password/reset", ResetPasswordController);
UserRouter.post("/user/authorization", verifyToken, async(req: AuthRequest, res) => {
  // Token is already verified by middleware, just return the decoded user info

  const user = await authenticateUser(req.user?.id as unknown as number);
  res.json({ 
    bool: true, 
    id: req.user!.id,
    data: user
  });
});

// Protected routes (use middleware)
UserRouter.delete('/api/account', verifyToken, DeleteMyAccountController);
UserRouter.delete('/user/delete/:id', authenticate, DeleteUserController);
UserRouter.put('/user/role/update/:id', authenticate, UpdateRoleController);
UserRouter.put('/user/email/update/:id', authenticate, UpdateEmailController);
UserRouter.put('/user/phone/update/:id', authenticate, UpdatePhoneController);
UserRouter.post("/user/photo/upload", authenticate, userPhotoUploadMiddleware, UploadUserPhotoController);
UserRouter.put('/user/photo/update/:id', authenticate, UpdatePhotoController);
UserRouter.put('/user/profile/update/:id', authenticate, UpdateProfileController);
UserRouter.put('/user/password/update/:id', authenticate, UpdatePasswordController);
UserRouter.get('/user/wallet', authenticate, GetWalletController);
UserRouter.get('/user/wallet/transactions', authenticate, ListWalletTransactionsController);
UserRouter.post('/user/wallet/send', authenticate, SendWalletController);
UserRouter.post('/user/wallet/withdraw', authenticate, WithdrawWalletController);
UserRouter.get('/user/wallet/recipient', authenticate, GetWalletRecipientController);
UserRouter.post('/user/wallet/pin', authenticate, CreateWalletPinController);
UserRouter.post('/user/wallet/pin/verify', authenticate, VerifyWalletPinController);
UserRouter.put('/user/wallet/pin', authenticate, ChangeWalletPinController);
UserRouter.post('/user/wallet/pin/recover', authenticate, RequestWalletPinResetController);
UserRouter.post('/user/wallet/pin/recover/verify', authenticate, VerifyWalletPinResetController);
UserRouter.post('/user/wallet/pin/recover/reset', authenticate, ResetWalletPinController);
UserRouter.get('/notifications', authenticate, ListNotificationsController);
UserRouter.post('/notifications/:notificationId/read', authenticate, MarkNotificationReadController);
