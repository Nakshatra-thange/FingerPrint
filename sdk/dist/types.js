"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisputeStatus = exports.EscrowStatus = void 0;
var EscrowStatus;
(function (EscrowStatus) {
    EscrowStatus["Active"] = "active";
    EscrowStatus["ThresholdMet"] = "thresholdMet";
    EscrowStatus["Disputed"] = "disputed";
    EscrowStatus["Released"] = "released";
    EscrowStatus["Refunded"] = "refunded";
})(EscrowStatus || (exports.EscrowStatus = EscrowStatus = {}));
var DisputeStatus;
(function (DisputeStatus) {
    DisputeStatus["Open"] = "open";
    DisputeStatus["ResolvedForReceiver"] = "resolvedForReceiver";
    DisputeStatus["ResolvedForPayer"] = "resolvedForPayer";
})(DisputeStatus || (exports.DisputeStatus = DisputeStatus = {}));
