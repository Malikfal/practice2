export const groupBy = <T, K extends PropertyKey>(array: T[], key: (item: T) => K) => {
  return array.reduce(
    (groups, item) => {
      (groups[key(item)] ||= []).push(item);
      return groups;
    },
    {} as Record<K, T[]>,
  );
};

export const groupByWithFunc = <T, K extends PropertyKey, G>(
  array: T[],
  key: (item: T) => K,
  groupFunc: (item: T) => G,
) => {
  return array.reduce(
    (groups, item) => {
      (groups[key(item)] ||= []).push(groupFunc(item));
      return groups;
    },
    {} as Record<K, G[]>,
  );
};
