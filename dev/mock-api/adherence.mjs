/**
 * The mock API's adherence routes, in the API's shapes (docs/decisions/adherence.md
 * in medora-backend): POST /v1/patient/activity/app-opened, which the
 * patient app calls each time the signed-in frame loads. The API counts one
 * a day; the mock only answers with the day it would count.
 */
import { patientOf } from "./patient.mjs";

const dayIn = (timeZone) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** The routes, in the server's [method, pattern, handler] shape. */
export function adherenceRoutes({ send, fail }) {
  return [
    [
      "POST",
      /^\/v1\/patient\/activity\/app-opened$/,
      (req, res) => {
        if (!patientOf(req, res, fail, "patient")) return;
        send(res, 200, { openedOn: dayIn("Australia/Sydney") });
      },
    ],
  ];
}
