import {
  Form,
  Modal,
  Input,
  Typography,
  Select,
  Button,
  Tooltip,
  Radio,
  InputNumber,
  Row,
  Card,
  Col,
  Collapse,
  Checkbox,
} from "antd";
import React, { useEffect, useState } from "react";
import { useShowModal } from "../components/ModalManager";
import { Auth, Config, User } from "../../gen/ts/v1/config_pb";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { formatErrorAlert, useAlertApi } from "../components/Alerts";
import { namePattern, validateForm } from "../lib/formutil";
import { useConfig } from "../components/ConfigProvider";
import { authenticationService, backrestService } from "../api";
import {useTranslation} from "react-i18next";

interface FormData {
  auth: {
    users: {
      name: string;
      passwordBcrypt: string;
      needsBcrypt?: boolean;
    }[];
  };
  instance: string;
}

export const SettingsModal = () => {
  let [config, setConfig] = useConfig();
  const showModal = useShowModal();
  const alertsApi = useAlertApi()!;
  const [form] = Form.useForm<FormData>();
  const { t } = useTranslation();

  if (!config) {
    return null;
  }

  const handleOk = async () => {
    try {
      // Validate form
      let formData = await validateForm(form);

      if (formData.auth?.users) {
        for (const user of formData.auth?.users) {
          if (user.needsBcrypt) {
            const hash = await authenticationService.hashPassword({
              value: user.passwordBcrypt,
            });
            user.passwordBcrypt = hash.value;
            delete user.needsBcrypt;
          }
        }
      }

      // Update configuration
      let newConfig = config!.clone();
      newConfig.auth = new Auth().fromJson(formData.auth, {
        ignoreUnknownFields: false,
      });
      newConfig.instance = formData.instance;

      if (!newConfig.auth?.users && !newConfig.auth?.disabled) {
        throw new Error(
          "At least one user must be configured or authentication must be disabled"
        );
      }

      setConfig(await backrestService.setConfig(newConfig));
      alertsApi.success("Settings updated", 5);
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (e: any) {
      alertsApi.error(formatErrorAlert(e, "Operation error: "), 15);
      console.error(e);
    }
  };

  const handleCancel = () => {
    showModal(null);
  };

  const users = config.auth?.users || [];

  return (
    <>
      <Modal
        open={true}
        onCancel={handleCancel}
        title={t('setting.title')}
        width="40vw"
        footer={[
          <Button key="back" onClick={handleCancel}>
            {t('common.button.cancel')}
          </Button>,
          <Button key="submit" type="primary" onClick={handleOk}>
            {t('common.button.submit')}
          </Button>,
        ]}
      >
        <Form
          autoComplete="off"
          form={form}
          labelCol={{ span: 6 }}
          wrapperCol={{ span: 16 }}
        >
          {users.length > 0 || config.auth?.disabled ? null : (
            <>
              <strong>Initial backrest setup! </strong>
              <p>
                Backrest has detected that you do not have any users configured,
                please add at least one user to secure the web interface.
              </p>
              <p>
                You can add more users later or, if you forget your password,
                reset users by editing the configuration file (typically in
                $HOME/.backrest/config.json)
              </p>
            </>
          )}
          <Tooltip title={t('setting.tooltip.instance_id')}>
            <Form.Item
              hasFeedback
              name="instance"
              label={t('setting.form.instance_id')}
              required
              initialValue={config.instance || ""}
              rules={[
                { required: true, message: "Instance ID is required" },
                {
                  pattern: namePattern,
                  message:
                    "Instance ID must be alphanumeric with '_-.' allowed as separators",
                },
              ]}
            >
              <Input
                placeholder={
                  t('setting.placeholder.instance_id')
                }
                disabled={!!config.instance}
              />
            </Form.Item>
          </Tooltip>
          <Form.Item
            label={t('setting.form.disable_authentication')}
            name={["auth", "disabled"]}
            valuePropName="checked"
            initialValue={config.auth?.disabled || false}
          >
            <Checkbox />
          </Form.Item>
          <Form.Item label={t('setting.form.users')} required={true}>
            <Form.List
              name={["auth", "users"]}
              initialValue={config.auth?.users?.map(protoToObj) || []}
            >
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => {
                    return (
                      <Row key={field.key} gutter={16}>
                        <Col span={11}>
                          <Form.Item
                            name={[field.name, "name"]}
                            rules={[
                              { required: true, message: "Name is required" },
                              {
                                pattern: namePattern,
                                message:
                                  "Name must be alphanumeric with dashes or underscores as separators",
                              },
                            ]}
                          >
                            <Input placeholder="Username" />
                          </Form.Item>
                        </Col>
                        <Col span={11}>
                          <Form.Item
                            name={[field.name, "passwordBcrypt"]}
                            rules={[
                              {
                                required: true,
                                message: "Password is required",
                              },
                            ]}
                          >
                            <Input.Password
                              placeholder="Password"
                              onFocus={() => {
                                form.setFieldValue(
                                  ["auth", "users", index, "needsBcrypt"],
                                  true
                                );
                                form.setFieldValue(
                                  ["auth", "users", index, "passwordBcrypt"],
                                  ""
                                );
                              }}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={2}>
                          <MinusCircleOutlined
                            onClick={() => {
                              remove(field.name);
                            }}
                          />
                        </Col>
                      </Row>
                    );
                  })}
                  <Form.Item>
                    <Button
                      type="dashed"
                      onClick={() => {
                        add();
                      }}
                      block
                    >
                      <PlusOutlined /> {t('setting.button.add_user')}
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>

          <Form.Item shouldUpdate label={t('setting.form.preview')}>
            {() => (
              <Collapse
                size="small"
                items={[
                  {
                    key: "1",
                    label: "Config as JSON",
                    children: (
                      <Typography>
                        <pre>
                          {JSON.stringify(form.getFieldsValue(), null, 2)}
                        </pre>
                      </Typography>
                    ),
                  },
                ]}
              />
            )}
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

const protoToObj = (proto: any) => {
  return JSON.parse(proto.toJsonString());
};
