export default {
  name: "$comment",
  callback: (context) => {
    context.argsCheck(1);
    if (context.isError) return;
    return "";
  },
};
