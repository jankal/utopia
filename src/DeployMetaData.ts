export interface DeployMetaData {
  id: string;
  md5: string;
  createdAt: string;
}

export function isDeployMetaData(object: object): object is DeployMetaData {
  const keys: (keyof DeployMetaData)[] = [
    'id',
    'md5',
    'createdAt'
  ];

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(object, key)) {
      return false;
    }
  }

  return true;
}
