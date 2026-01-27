import { updateProjectNameController } from './update-project-name.js'

describe('PATCH /exemption/project-name', () => {
  describe('controller configuration', () => {
    it('should use updateProjectNameHandler with correct configuration', () => {
      expect(updateProjectNameController.handler).toBeDefined()
      expect(typeof updateProjectNameController.handler).toBe('function')
    })

    it('should have pre hook with authorizeOwnership configured for exemptions', () => {
      expect(updateProjectNameController.options.pre).toBeDefined()
      expect(updateProjectNameController.options.pre).toHaveLength(1)
      expect(updateProjectNameController.options.pre[0].method).toBeDefined()
    })

    it('should have payload validation configured', () => {
      expect(updateProjectNameController.options.validate).toBeDefined()
      expect(updateProjectNameController.options.validate.payload).toBeDefined()
    })
  })

  describe('payload validation', () => {
    const payloadValidator =
      updateProjectNameController.options.validate.payload

    it('should fail if projectName is missing', () => {
      const result = payloadValidator.validate({})

      expect(result.error.message).toContain('PROJECT_NAME_REQUIRED')
    })

    it('should fail if projectName is empty string', () => {
      const result = payloadValidator.validate({
        projectName: ''
      })

      expect(result.error.message).toContain('PROJECT_NAME_REQUIRED')
    })

    it('should require id field', () => {
      const result = payloadValidator.validate({
        projectName: 'Test Project'
      })

      expect(result.error).toBeDefined()
    })
  })
})
