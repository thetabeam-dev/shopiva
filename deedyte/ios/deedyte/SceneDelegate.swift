import UIKit

/// iOS 27 / Xcode 27 require a UIScene lifecycle. React Native 0.85 still creates
/// the window on AppDelegate; attach that window to the scene so App Review does
/// not trap on UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }

    if let appDelegate = UIApplication.shared.delegate as? AppDelegate,
       let appWindow = appDelegate.window {
      appWindow.windowScene = windowScene
      window = appWindow
      window?.makeKeyAndVisible()
      return
    }

    let created = UIWindow(windowScene: windowScene)
    window = created
    created.makeKeyAndVisible()
    if let appDelegate = UIApplication.shared.delegate as? AppDelegate {
      appDelegate.window = created
    }
  }
}
