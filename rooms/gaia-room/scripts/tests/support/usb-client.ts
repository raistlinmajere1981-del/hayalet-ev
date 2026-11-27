import { createPublicKey, randomUUID } from "node:crypto";
import * as asn from "asn1js";
import * as pki from "pkijs";

export async function usbClient(curve = "P-256", extensions?: pki.Extension[], exportable = false) {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: curve }, exportable, [
    "sign",
    "verify",
  ]);
  const info = new pki.PublicKeyInfo();
  await info.importKey(keys.publicKey);
  const csr = new pki.CertificationRequest({
    version: 0,
    subjectPublicKeyInfo: info,
    subject: new pki.RelativeDistinguishedNames({
      typesAndValues: [
        new pki.AttributeTypeAndValue({
          type: "2.5.4.3",
          value: new asn.Utf8String({ value: "Untrusted USB subject" }),
        }),
      ],
    }),
    attributes: extensions
      ? [
          new pki.Attribute({
            type: "1.2.840.113549.1.9.14",
            values: [new pki.Extensions({ extensions }).toSchema()],
          }),
        ]
      : [],
  });
  await csr.sign(keys.privateKey, "SHA-256");
  const publicKey = createPublicKey({
    key: Buffer.from(info.toSchema().toBER()),
    format: "der",
    type: "spki",
  });
  return {
    keys,
    publicKey,
    usb: {
      version: 1,
      installationId: randomUUID(),
      csr: Buffer.from(csr.toSchema().toBER()).toString("base64"),
    },
  };
}
