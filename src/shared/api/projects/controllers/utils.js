export const getStatusFilter = (status) => {
  if (!status) {
    return {}
  }

  return {
    status: {
      $in: status
    }
  }
}
