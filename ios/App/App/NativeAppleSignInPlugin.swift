import Foundation
import Capacitor
import AuthenticationServices
import CryptoKit
import Security
import UIKit

@objc(NativeAppleSignInPlugin)
public class NativeAppleSignInPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeAppleSignInPlugin"
    public let jsName = "NativeAppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)
    ]

    private var activeCallID: String?
    private var activeNonce: String?

    @objc func isAvailable(_ call: CAPPluginCall) {
        if #available(iOS 13.0, *) {
            call.resolve(["available": true])
            return
        }

        call.resolve(["available": false])
    }

    @objc func signIn(_ call: CAPPluginCall) {
        guard #available(iOS 13.0, *) else {
            call.unavailable("Sign in with Apple requires iOS 13 or later.")
            return
        }

        guard activeCallID == nil else {
            call.reject("Another Apple sign-in request is already running.", "SIGN_IN_IN_PROGRESS")
            return
        }

        let nonce = randomNonceString()
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(nonce)

        activeNonce = nonce
        activeCallID = call.callbackId
        bridge?.saveCall(call)

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self

        DispatchQueue.main.async {
            controller.performRequests()
        }
    }

    private func resolveActiveCall(with result: [String: Any]) {
        guard let call = savedCall(), let callID = activeCallID else {
            clearActiveRequest()
            return
        }

        call.resolve(result)
        bridge?.releaseCall(withID: callID)
        clearActiveRequest()
    }

    private func rejectActiveCall(message: String, code: String, error: Error? = nil) {
        guard let call = savedCall(), let callID = activeCallID else {
            clearActiveRequest()
            return
        }

        call.reject(message, code, error)
        bridge?.releaseCall(withID: callID)
        clearActiveRequest()
    }

    private func savedCall() -> CAPPluginCall? {
        guard let callID = activeCallID else {
            return nil
        }

        return bridge?.savedCall(withID: callID)
    }

    private func clearActiveRequest() {
        activeCallID = nil
        activeNonce = nil
    }

    private func sha256(_ input: String) -> String {
        let inputData = Data(input.utf8)
        let hashedData = SHA256.hash(data: inputData)
        return hashedData.map { String(format: "%02x", $0) }.joined()
    }

    private func randomNonceString(length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remainingLength = length

        while remainingLength > 0 {
            let randoms: [UInt8] = (0..<16).map { _ in
                var random: UInt8 = 0
                let errorCode = SecRandomCopyBytes(kSecRandomDefault, 1, &random)
                if errorCode != errSecSuccess {
                    fatalError("Unable to generate nonce. SecRandomCopyBytes failed with OSStatus \(errorCode)")
                }
                return random
            }

            randoms.forEach { random in
                if remainingLength == 0 {
                    return
                }

                if random < charset.count {
                    result.append(charset[Int(random)])
                    remainingLength -= 1
                }
            }
        }

        return result
    }
}

@available(iOS 13.0, *)
extension NativeAppleSignInPlugin: ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            rejectActiveCall(message: "Apple did not return a valid credential.", code: "INVALID_CREDENTIAL")
            return
        }

        guard let nonce = activeNonce else {
            rejectActiveCall(message: "Missing Apple sign-in nonce.", code: "MISSING_NONCE")
            return
        }

        guard let identityTokenData = credential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8),
              !identityToken.isEmpty else {
            rejectActiveCall(message: "Apple did not return an identity token.", code: "MISSING_IDENTITY_TOKEN")
            return
        }

        var result: [String: Any] = [
            "identityToken": identityToken,
            "nonce": nonce,
            "user": credential.user
        ]

        if let authorizationCodeData = credential.authorizationCode,
           let authorizationCode = String(data: authorizationCodeData, encoding: .utf8),
           !authorizationCode.isEmpty {
            result["authorizationCode"] = authorizationCode
        }

        if let email = credential.email, !email.isEmpty {
            result["email"] = email
        }

        if let givenName = credential.fullName?.givenName, !givenName.isEmpty {
            result["givenName"] = givenName
        }

        if let familyName = credential.fullName?.familyName, !familyName.isEmpty {
            result["familyName"] = familyName
        }

        let fullNameParts = [
            credential.fullName?.givenName,
            credential.fullName?.middleName,
            credential.fullName?.familyName
        ]
            .compactMap { value in
                let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                return trimmed.isEmpty ? nil : trimmed
            }

        if !fullNameParts.isEmpty {
            result["fullName"] = fullNameParts.joined(separator: " ")
        }

        resolveActiveCall(with: result)
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let nsError = error as NSError
        let authorizationError = ASAuthorizationError.Code(rawValue: nsError.code)

        switch authorizationError {
        case .canceled:
            rejectActiveCall(message: "Apple sign-in was cancelled by the user.", code: "CANCELED", error: error)
        case .failed:
            rejectActiveCall(message: "Apple sign-in failed.", code: "FAILED", error: error)
        case .invalidResponse:
            rejectActiveCall(message: "Apple returned an invalid sign-in response.", code: "INVALID_RESPONSE", error: error)
        case .notHandled:
            rejectActiveCall(message: "Apple sign-in could not be completed.", code: "NOT_HANDLED", error: error)
        case .unknown, .none:
            rejectActiveCall(message: error.localizedDescription, code: "UNKNOWN", error: error)
        @unknown default:
            rejectActiveCall(message: error.localizedDescription, code: "UNKNOWN", error: error)
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let window = bridge?.viewController?.view.window {
            return window
        }

        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
            if let keyWindow = scene.windows.first(where: { $0.isKeyWindow }) {
                return keyWindow
            }

            if let window = scene.windows.first {
                return window
            }
        }

        return ASPresentationAnchor()
    }
}
