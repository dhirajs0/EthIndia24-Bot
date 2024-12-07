export const extractMessageFromReq = (req) =>
    req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
  
export const extractBusinessPhoneNumberIdFromReq = (req) =>
    req.body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
  